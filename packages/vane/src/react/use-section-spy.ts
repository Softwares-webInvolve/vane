import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { createSectionObserver, type SectionObserver } from '../core/observers';
import { defaultGetLabel, resolveReadingLine, type Marker, type SpyState } from '../core/heading-index';

export interface UseSectionSpyOptions {
	/** Elements considered section markers. */
	selector?: string;
	/** Where to query `selector` and watch for mutations. Defaults to `document`. */
	scope?: Document | Element;
	getLabel?: (el: Element) => string;
	/** Fraction of the viewport (0..1) or an absolute px/function. */
	readingLine?: number | `${number}px` | (() => number);
	/** Width of the Schmitt-trigger band around the reading line, in px. */
	band?: number;
	/** Hold the first section active when scrolled above it, instead of blanking. */
	sticky?: boolean;
	/** Label shown before any section has resolved. */
	fallback?: string;
	watchMutations?: boolean;
	onChange?: (active: Marker | null) => void;
}

export interface UseSectionSpyResult {
	active: Marker | null;
	label: string;
	sections: Marker[];
	refresh: () => void;
	getSectionLinkProps: (id: string) => { 'aria-current'?: 'location' };
	labelProps: { 'aria-hidden': true };
}

const EMPTY_MARKERS: Marker[] = [];

interface Snapshot {
	active: Marker | null;
}

const SERVER_SNAPSHOT: Snapshot = { active: null };

export function useSectionSpy(options: UseSectionSpyOptions = {}): UseSectionSpyResult {
	const {
		selector = 'h2[id], [data-vane-label]',
		getLabel = defaultGetLabel,
		readingLine = 0.3,
		band = 4,
		sticky = true,
		fallback = '',
		watchMutations = true,
		onChange,
	} = options;

	// `document` is a stable reference across renders; an explicit `scope`
	// element is the caller's own and expected to be stable too (a ref value
	// or similarly memoised), same contract as any other effect dependency.
	const scope = options.scope ?? (typeof document !== 'undefined' ? document : undefined);

	const observerRef = useRef<SectionObserver | null>(null);
	const markersRef = useRef<Marker[]>(EMPTY_MARKERS);
	const listenersRef = useRef(new Set<() => void>());
	const snapshotRef = useRef<Snapshot>(SERVER_SNAPSHOT);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const subscribe = useCallback(
		(onStoreChange: () => void) => {
			listenersRef.current.add(onStoreChange);

			if (!scope) {
				return () => listenersRef.current.delete(onStoreChange);
			}

			if (!observerRef.current) {
				// Scoping to an element (rather than the document) also scopes the
				// IntersectionObserver root to it, so the reading line is measured
				// against that scroll container instead of the viewport.
				const root = scope instanceof Element ? scope : null;

				observerRef.current = createSectionObserver({
					selector,
					scope,
					root,
					readingLine: () =>
						resolveReadingLine(readingLine, (root ?? document.documentElement).clientHeight),
					band,
					sticky,
					watchMutations,
					getLabel,
					onChange: (spy: SpyState, markers: Marker[]) => {
						markersRef.current = markers;
						const active = spy.active >= 0 ? (markers[spy.active] ?? null) : null;
						snapshotRef.current = { active };
						onChangeRef.current?.(active);
						for (const l of listenersRef.current) l();
					},
				});
			}

			return () => {
				listenersRef.current.delete(onStoreChange);
				if (listenersRef.current.size === 0) {
					observerRef.current?.destroy();
					observerRef.current = null;
				}
			};
		},
		[scope, selector, readingLine, band, sticky, watchMutations, getLabel],
	);

	const getSnapshot = useCallback(() => snapshotRef.current, []);
	const getServerSnapshot = useCallback(() => SERVER_SNAPSHOT, []);

	const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	const refresh = useCallback(() => observerRef.current?.refresh(), []);

	const getSectionLinkProps = useCallback(
		(id: string): { 'aria-current'?: 'location' } =>
			snapshot.active?.id === id ? { 'aria-current': 'location' } : {},
		[snapshot.active],
	);

	// `aria-hidden` is the whole point of this file's a11y story: on mobile the
	// capsule IS the toggle button, and a button whose accessible name changes
	// on every scroll tick is worse than a live region. The semantics live on
	// `aria-current="location"` via `getSectionLinkProps`, not here.
	const labelProps = useMemo<{ 'aria-hidden': true }>(() => ({ 'aria-hidden': true }), []);

	return {
		active: snapshot.active,
		label: snapshot.active?.label ?? fallback,
		sections: markersRef.current,
		refresh,
		getSectionLinkProps,
		labelProps,
	};
}
