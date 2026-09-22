import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
	type RefObject,
} from 'react';
import * as focus from '../core/focus';
import {
	defaultConfig,
	directionOf,
	initialState,
	reduce,
	type Direction,
	type HysteresisConfig,
	type HysteresisState,
	type MorphState,
	type Sample,
} from '../core/hysteresis';
import { observeMetrics, round2 } from './use-nav-height';
import { useReducedMotion } from './use-reduced-motion';
import * as scrollSource from '../core/scroll-source';

export type { MorphState, Direction };

export interface UseNavMorphOptions {
	/** Below this scroll position the nav is always `full`. */
	offset?: number;
	/** Cumulative px of travel required to flip state. A single number applies to both directions. */
	threshold?: number | { up: number; down: number };
	/** What "collapsed" means for this instance. */
	collapseTo?: 'compact' | 'hidden';
	/** Disables the whole state machine; the nav stays `full`. */
	disabled?: boolean;
	/** Scroll container. `null`/omitted observes the document/window. */
	root?: HTMLElement | null;
	reducedMotion?: 'user' | 'always' | 'never';
	/** Extra downward travel a keyboard-focused nav is allowed before collapsing anyway. */
	focusDeferDistance?: number;
	/** Custom property name for the published height. */
	heightVar?: string;
}

interface PropBag {
	ref: RefObject<HTMLElement | null>;
	[key: string]: unknown;
}

export interface UseNavMorphResult {
	state: MorphState;
	collapsed: boolean;
	direction: Direction;
	reducedMotion: boolean;
	height: number;
	navProps: PropBag;
	viewportProps: PropBag;
	fullProps: PropBag;
	compactProps: PropBag;
	expand: () => void;
	collapse: () => void;
}

/** A single number applies symmetrically; the plan calls this out explicitly. */
export function normalizeThreshold(
	threshold: number | { up: number; down: number } | undefined,
	fallback: { up: number; down: number },
): { up: number; down: number } {
	if (threshold === undefined) return fallback;
	if (typeof threshold === 'number') return { up: threshold, down: threshold };
	return threshold;
}

// A stable reference (not recreated per render) so hydration never mismatches:
// `useSyncExternalStore` compares server and client snapshots by value/identity
// during the hydration pass, and the plan requires `state: 'full'` regardless
// of where the client actually is on scroll restore.
const SERVER_SNAPSHOT: HysteresisState = { state: 'full', dir: 0, anchorY: 0, lastY: 0 };

type Region = 'full' | 'compact';

export function useNavMorph(options: UseNavMorphOptions = {}): UseNavMorphResult {
	const {
		offset = defaultConfig.offset,
		threshold,
		collapseTo = defaultConfig.collapseTo,
		disabled = false,
		root = null,
		reducedMotion: reducedMotionOption = 'user',
		focusDeferDistance = defaultConfig.focusDeferDistance,
		heightVar = '--vane-height',
	} = options;

	const { up: thresholdUp, down: thresholdDown } = normalizeThreshold(threshold, {
		up: defaultConfig.thresholdUp,
		down: defaultConfig.thresholdDown,
	});

	const configRef = useRef<HysteresisConfig>({
		offset,
		thresholdUp,
		thresholdDown,
		collapseTo,
		focusDeferDistance,
	});
	configRef.current = { offset, thresholdUp, thresholdDown, collapseTo, focusDeferDistance };

	const navRef = useRef<HTMLElement | null>(null);
	const viewportRef = useRef<HTMLElement | null>(null);
	const fullRef = useRef<HTMLElement | null>(null);
	const compactRef = useRef<HTMLElement | null>(null);

	const stateRef = useRef<HysteresisState>(initialState(0));
	const listenersRef = useRef(new Set<() => void>());

	const notify = useCallback(() => {
		for (const l of listenersRef.current) l();
	}, []);

	const subscribeStore = useCallback(
		(onStoreChange: () => void) => {
			listenersRef.current.add(onStoreChange);

			if (disabled || typeof window === 'undefined') {
				return () => listenersRef.current.delete(onStoreChange);
			}

			const scrollRoot: Window | Element = root ?? window;
			const unsubscribe = scrollSource.subscribe(scrollRoot, (sample) => {
				const nav = navRef.current;
				const active = document.activeElement;
				const focusInside = !!(nav && active && nav.contains(active));
				const keyboardFocus = focusInside && focus.isKeyboardFocus(active);

				const fullSample: Sample = { ...sample, focusInside, keyboardFocus };
				const next = reduce(stateRef.current, fullSample, configRef.current);
				if (next !== stateRef.current) {
					stateRef.current = next;
					notify();
				}
			});

			return () => {
				listenersRef.current.delete(onStoreChange);
				unsubscribe();
			};
		},
		[disabled, root, notify],
	);

	const getSnapshot = useCallback(() => stateRef.current, []);
	const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, []);

	const morph = useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
	const reducedMotion = useReducedMotion(reducedMotionOption);

	// `collapseTo: 'hidden'` plus inert would leave a keyboard user with zero
	// navigation the moment they tab in while the nav is hidden — there is no
	// scroll-driven reversal coming to save them. Promote hidden -> compact on
	// the first `:focus-visible` focusin anywhere, so there is always
	// something reachable. Guarded against our own handoff's synchronous
	// `focus()` call via `programmaticFocus`, which is not a real tab press.
	useEffect(() => {
		if (collapseTo !== 'hidden' || disabled) return;

		const onFocusIn = (event: FocusEvent) => {
			if (focus.programmaticFocus.current) return;
			if (stateRef.current.state !== 'hidden') return;
			if (!focus.isKeyboardFocus(event.target as Element | null)) return;

			const y = stateRef.current.lastY;
			stateRef.current = { state: 'compact', dir: -1, anchorY: y, lastY: y };
			notify();
		};

		document.addEventListener('focusin', onFocusIn);
		return () => document.removeEventListener('focusin', onFocusIn);
	}, [collapseTo, disabled, notify]);

	// ── Height + measured-width (GATE1) ───────────────────────────────────
	// One ResizeObserver covers the nav's height AND both regions' natural
	// widths, per the plan's instruction to ride the RO already required for
	// `--vane-height` rather than adding a second one for the morph.
	const [height, setHeight] = useState(0);
	const widthsRef = useRef<Record<Region, { w: number; h: number } | null>>({
		full: null,
		compact: null,
	});
	const activeRegionRef = useRef<Region>(morph.state === 'full' ? 'full' : 'compact');

	const applyViewportVars = useCallback((region: Region) => {
		const viewport = viewportRef.current;
		const size = widthsRef.current[region];
		if (!viewport || !size) return;
		viewport.style.setProperty('--vane-w', `${size.w}px`);
		viewport.style.setProperty('--vane-h', `${size.h}px`);
	}, []);

	useEffect(() => {
		const nav = navRef.current;
		if (!nav) return;

		const target = root ?? document.documentElement;
		const full = fullRef.current;
		const compact = compactRef.current;

		let lastHeight: number | null = null;
		let maxHeight = 0;

		const applyHeight = (h: number) => {
			if (lastHeight === h) return;
			lastHeight = h;
			target.style.setProperty(heightVar, `${h}px`);
			nav.style.setProperty(heightVar, `${h}px`);
			if (h > maxHeight) {
				maxHeight = h;
				target.style.setProperty(`${heightVar}-max`, `${h}px`);
			}
			setHeight(h);
		};

		applyHeight(round2(nav.getBoundingClientRect().height));

		const measure = (region: Region, el: HTMLElement) => {
			const rect = el.getBoundingClientRect();
			widthsRef.current[region] = { w: round2(rect.width), h: round2(rect.height) };
			if (activeRegionRef.current === region) applyViewportVars(region);
		};
		if (full) measure('full', full);
		if (compact) measure('compact', compact);

		return observeMetrics([nav, full, compact], (el, size) => {
			if (el === nav) {
				applyHeight(size.height);
				return;
			}
			const region: Region = el === full ? 'full' : 'compact';
			widthsRef.current[region] = { w: size.width, h: size.height };
			if (activeRegionRef.current === region) applyViewportVars(region);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [heightVar, root, applyViewportVars]);

	// ── Focus handoff + inert ──────────────────────────────────────────────
	const mountedRef = useRef(false);

	useLayoutEffect(() => {
		const full = fullRef.current;
		const compact = compactRef.current;
		const nav = navRef.current;
		if (!full || !compact || !nav) return;

		const nextRegion: Region = morph.state === 'full' ? 'full' : 'compact';
		activeRegionRef.current = nextRegion;

		// On mount there is nothing to hand focus off from — just establish
		// which region is interactive. On every later transition, actually
		// move focus (see `focus.handoff` for why the ordering there matters).
		if (!mountedRef.current) {
			focus.applyInert(full, nextRegion !== 'full');
			focus.applyInert(compact, nextRegion === 'full');
		} else if (nextRegion === 'full') {
			focus.handoff({ from: compact, to: full, navEl: nav });
		} else {
			focus.handoff({ from: full, to: compact, navEl: nav });
		}

		mountedRef.current = true;
		applyViewportVars(nextRegion);
	}, [morph.state, applyViewportVars]);

	const expand = useCallback(() => {
		const y = stateRef.current.lastY;
		stateRef.current = { state: 'full', dir: 0, anchorY: y, lastY: y };
		notify();
	}, [notify]);

	const collapse = useCallback(() => {
		const y = stateRef.current.lastY;
		stateRef.current = { state: configRef.current.collapseTo, dir: 0, anchorY: y, lastY: y };
		notify();
	}, [notify]);

	const scrolled = morph.lastY > offset;

	const navProps = useMemo<PropBag>(
		() => ({
			ref: navRef,
			tabIndex: -1,
			'data-vane': '',
			'data-state': morph.state,
			...(scrolled ? { 'data-scrolled': '' } : {}),
		}),
		[morph.state, scrolled],
	);

	const viewportProps = useMemo<PropBag>(
		() => ({ ref: viewportRef, 'data-state': morph.state }),
		[morph.state],
	);

	const fullProps = useMemo<PropBag>(() => ({ ref: fullRef, 'data-vane-region': 'full' }), []);
	const compactProps = useMemo<PropBag>(
		() => ({ ref: compactRef, 'data-vane-region': 'compact' }),
		[],
	);

	return {
		state: morph.state,
		collapsed: morph.state !== 'full',
		direction: directionOf(morph.dir),
		reducedMotion,
		height,
		navProps,
		viewportProps,
		fullProps,
		compactProps,
		expand,
		collapse,
	};
}
