/**
 * The DOM machinery behind `heading-index.ts`: two half-plane
 * IntersectionObservers that feed `select()`, a MutationObserver for
 * lazily-mounted sections, and one batched geometry pass for the answer that
 * must exist before either observer has had a chance to fire.
 *
 * This file is deliberately dumb about anything `heading-index.ts` already
 * decides — it only ever produces `HalfPlanes` and marker lists; every
 * selection decision lives in the pure module.
 */

import {
	type HalfPlanes,
	type Marker,
	type SpyState,
	initialSpyState,
	select,
	selectFromTops,
} from './heading-index';

const warnedSelectors = new Set<string>();

function isIgnored(el: Element): boolean {
	return el.closest('[data-vane-ignore]') !== null;
}

function queryElements(scope: Document | Element, selector: string): Element[] {
	return Array.from(scope.querySelectorAll(selector)).filter((el) => !isIgnored(el));
}

function toMarkers(elements: Element[], getLabel: (el: Element) => string): Marker[] {
	return elements.map((el, index) => ({
		index,
		id: el.id || el.closest('[id]')?.id,
		label: getLabel(el),
	}));
}

function sameElements(a: Element[], b: Element[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

/**
 * `rootMargin` that turns an IntersectionObserver's root into a half-plane
 * cut at `edgeFromTop` px from the top of the viewport (or scroll-root
 * element, when one is given as `root`).
 *
 * The top expansion nominally wants to be the whole scroll extent — a marker
 * scrolled off the top of a long page must still register as "above the
 * line" — but an unbounded top margin is unmeasured perf territory on very
 * long documents (see the plan's prototype-gates section), so it is clamped
 * to ten viewports. Ten is arbitrary; it comfortably covers any reading
 * position while staying far short of where a document's own length would
 * start to matter.
 */
export function computeRootMargin(edgeFromTop: number, viewport: number, scrollExtent: number): string {
	const top = Math.min(scrollExtent, 10 * viewport);
	const bottom = viewport - edgeFromTop;
	return `${top}px 0px ${-bottom}px 0px`;
}

export interface SectionObserverOptions {
	selector: string;
	scope: Document | Element;
	/** IntersectionObserver root. `null` observes against the viewport. */
	root: Element | null;
	/** Resolved fresh on every (re)init, since it may depend on viewport height. */
	readingLine: () => number;
	band: number;
	sticky: boolean;
	watchMutations: boolean;
	getLabel: (el: Element) => string;
	onChange: (state: SpyState, markers: Marker[]) => void;
}

export interface SectionObserver {
	refresh(): void;
	destroy(): void;
}

export function createSectionObserver(opts: SectionObserverOptions): SectionObserver {
	if (typeof document === 'undefined') {
		return { refresh() {}, destroy() {} };
	}

	let destroyed = false;
	let reinitRaf: number | null = null;

	let currentElements: Element[] = [];
	let currentMarkers: Marker[] = [];
	let elementIndex = new Map<Element, number>();
	let spyState: SpyState = initialSpyState();

	let ioAdvance: IntersectionObserver | null = null;
	let ioRetreat: IntersectionObserver | null = null;
	let aboveAdvance = new Set<number>();
	let aboveRetreat = new Set<number>();

	const scrollExtentOf = (): number =>
		opts.root ? opts.root.scrollHeight : document.documentElement.scrollHeight;

	const viewportOf = (): number =>
		opts.root ? opts.root.clientHeight : document.documentElement.clientHeight;

	function disconnectObservers(): void {
		ioAdvance?.disconnect();
		ioRetreat?.disconnect();
		ioAdvance = null;
		ioRetreat = null;
	}

	function commit(): void {
		const next = select(spyState, { aboveAdvance, aboveRetreat } satisfies HalfPlanes, opts.sticky);
		if (next !== spyState) {
			spyState = next;
			opts.onChange(spyState, currentMarkers);
		}
	}

	function handleAdvance(ioEntries: IntersectionObserverEntry[]): void {
		for (const entry of ioEntries) {
			const i = elementIndex.get(entry.target);
			if (i === undefined) continue;
			if (entry.isIntersecting) aboveAdvance.add(i);
			else aboveAdvance.delete(i);
		}
		commit();
	}

	function handleRetreat(ioEntries: IntersectionObserverEntry[]): void {
		for (const entry of ioEntries) {
			const i = elementIndex.get(entry.target);
			if (i === undefined) continue;
			if (entry.isIntersecting) aboveRetreat.add(i);
			else aboveRetreat.delete(i);
		}
		commit();
	}

	function setupObservers(elements: Element[], line: number, viewport: number): void {
		disconnectObservers();
		aboveAdvance = new Set();
		aboveRetreat = new Set();

		const scrollExtent = scrollExtentOf();
		const advanceMargin = computeRootMargin(line - opts.band / 2, viewport, scrollExtent);
		const retreatMargin = computeRootMargin(line + opts.band / 2, viewport, scrollExtent);

		ioAdvance = new IntersectionObserver(handleAdvance, {
			root: opts.root,
			rootMargin: advanceMargin,
			threshold: 0,
		});
		ioRetreat = new IntersectionObserver(handleRetreat, {
			root: opts.root,
			rootMargin: retreatMargin,
			threshold: 0,
		});

		for (const el of elements) {
			ioAdvance.observe(el);
			ioRetreat.observe(el);
		}
	}

	function reinit(): void {
		if (destroyed) return;

		const elements = queryElements(opts.scope, opts.selector);
		currentElements = elements;

		if (elements.length === 0) {
			if (process.env.NODE_ENV !== 'production' && !warnedSelectors.has(opts.selector)) {
				warnedSelectors.add(opts.selector);
				// eslint-disable-next-line no-console
				console.warn(
					`[vane] useSectionSpy found no elements matching "${opts.selector}" inside`,
					opts.scope,
					'— the label will stay empty. Check the selector and the `scope` option.',
				);
			}
			disconnectObservers();
			currentMarkers = [];
			elementIndex = new Map();
			spyState = initialSpyState();
			opts.onChange(spyState, currentMarkers);
			return;
		}

		currentMarkers = toMarkers(elements, opts.getLabel);
		elementIndex = new Map(elements.map((el, i) => [el, i]));

		// One batched read, no interleaved writes, inside the single frame this
		// function already runs in (see `scheduleReinit`) — so a correct answer
		// exists before either observer has delivered anything.
		const viewport = viewportOf();
		const line = opts.readingLine();
		const tops = elements.map((el) => el.getBoundingClientRect().top);
		spyState = { active: selectFromTops(tops, line) };
		opts.onChange(spyState, currentMarkers);

		setupObservers(elements, line, viewport);
	}

	function scheduleReinit(): void {
		if (reinitRaf !== null) return;
		reinitRaf = requestAnimationFrame(() => {
			reinitRaf = null;
			reinit();
		});
	}

	let mo: MutationObserver | null = null;
	if (opts.watchMutations) {
		mo = new MutationObserver(() => {
			// Loop guard, critical: the label this drives is rendered inside the
			// observed scope. Without this, "mutation -> reindex -> setState ->
			// render -> mutation" is a real cycle, not a hypothetical one.
			const nextElements = queryElements(opts.scope, opts.selector);
			if (sameElements(nextElements, currentElements)) return;
			scheduleReinit();
		});
		mo.observe(opts.scope, {
			childList: true,
			subtree: true,
			attributeFilter: ['data-vane-label', 'id'],
		});
	}

	const onResize = () => scheduleReinit();
	const onPageShow = (event: PageTransitionEvent) => {
		if (event.persisted) scheduleReinit();
	};
	const onVisibility = () => {
		if (document.visibilityState === 'visible') scheduleReinit();
	};

	window.addEventListener('resize', onResize);
	window.addEventListener('pageshow', onPageShow as EventListener);
	document.addEventListener('visibilitychange', onVisibility);

	scheduleReinit();

	return {
		refresh() {
			scheduleReinit();
		},
		destroy() {
			destroyed = true;
			if (reinitRaf !== null) {
				cancelAnimationFrame(reinitRaf);
				reinitRaf = null;
			}
			disconnectObservers();
			mo?.disconnect();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('pageshow', onPageShow as EventListener);
			document.removeEventListener('visibilitychange', onVisibility);
		},
	};
}
