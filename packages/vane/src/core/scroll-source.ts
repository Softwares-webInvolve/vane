/**
 * One rAF-coalesced scroll subscription per scroll root, refcounted across
 * every subscriber that asks for it.
 *
 * Two things matter here and both are load-bearing:
 *
 * 1. `y` is read ONLY inside the rAF callback, never in the `scroll` event
 *    handler. Reading `scrollY`/`scrollTop` synchronously inside a scroll
 *    handler forces the browser to flush layout to answer, on every single
 *    event — the classic scroll-jank bug. Coalescing into one read per frame
 *    (shared by every subscriber on this root) turns that into effectively
 *    free.
 * 2. Refcounting per root. Multiple `useNavMorph`/consumers on the same page
 *    (or the same instance re-subscribing across renders) must not register
 *    N independent `scroll` listeners — they share one, and the listener is
 *    torn down only when the last subscriber leaves.
 */

export interface ScrollSample {
	/** Raw scroll position. May be out of range during iOS rubber-band. */
	y: number;
	/** `scrollHeight - clientHeight` of the scroll root. */
	maxY: number;
	/** Viewport height of the scroll root. */
	viewport: number;
}

type Listener = (sample: ScrollSample) => void;

interface Entry {
	root: Window | Element;
	listeners: Set<Listener>;
	rafId: number | null;
	maxY: number;
	viewport: number;
	ro: ResizeObserver | null;
	onScroll: () => void;
	onPageShow: (event: PageTransitionEvent) => void;
	onVisibility: () => void;
}

const entries = new Map<Window | Element, Entry>();

const isWindow = (root: Window | Element): root is Window => root === window;

function readY(root: Window | Element): number {
	return isWindow(root) ? window.scrollY : (root as Element).scrollTop;
}

function readMetrics(root: Window | Element): { maxY: number; viewport: number } {
	const el = isWindow(root) ? document.documentElement : (root as Element);
	const viewport = el.clientHeight;
	const maxY = Math.max(0, el.scrollHeight - viewport);
	return { maxY, viewport };
}

function scheduleFlush(entry: Entry): void {
	if (entry.rafId !== null) return;
	entry.rafId = requestAnimationFrame(() => {
		entry.rafId = null;
		const y = readY(entry.root);
		const sample: ScrollSample = { y, maxY: entry.maxY, viewport: entry.viewport };
		for (const listener of entry.listeners) listener(sample);
	});
}

function createEntry(root: Window | Element): Entry {
	const metrics = readMetrics(root);

	const entry: Entry = {
		root,
		listeners: new Set(),
		rafId: null,
		maxY: metrics.maxY,
		viewport: metrics.viewport,
		ro: null,
		onScroll: () => {},
		onPageShow: () => {},
		onVisibility: () => {},
	};

	entry.onScroll = () => scheduleFlush(entry);

	// bfcache restores fire no `scroll` event at all — without this the nav
	// is stuck rendering whatever state it was frozen in.
	entry.onPageShow = (event) => {
		if (!event.persisted) return;
		const m = readMetrics(entry.root);
		entry.maxY = m.maxY;
		entry.viewport = m.viewport;
		scheduleFlush(entry);
	};

	// Find-in-page can scroll the page to a match without dispatching
	// `scroll` in some engines; resync when the tab becomes visible again.
	entry.onVisibility = () => {
		if (document.visibilityState === 'visible') scheduleFlush(entry);
	};

	const target: EventTarget = isWindow(root) ? window : root;
	target.addEventListener('scroll', entry.onScroll, { passive: true });
	window.addEventListener('pageshow', entry.onPageShow as EventListener);
	document.addEventListener('visibilitychange', entry.onVisibility);

	if (typeof ResizeObserver !== 'undefined') {
		entry.ro = new ResizeObserver(() => {
			const m = readMetrics(entry.root);
			entry.maxY = m.maxY;
			entry.viewport = m.viewport;
		});
		entry.ro.observe(isWindow(root) ? document.documentElement : (root as Element));
	}

	entries.set(root, entry);
	return entry;
}

function destroyEntry(entry: Entry): void {
	const target: EventTarget = isWindow(entry.root) ? window : entry.root;
	target.removeEventListener('scroll', entry.onScroll);
	window.removeEventListener('pageshow', entry.onPageShow as EventListener);
	document.removeEventListener('visibilitychange', entry.onVisibility);
	entry.ro?.disconnect();
	if (entry.rafId !== null) {
		cancelAnimationFrame(entry.rafId);
		entry.rafId = null;
	}
	entries.delete(entry.root);
}

/**
 * Subscribe to coalesced scroll samples for `root` (a scroll container, or
 * `window` for the document). Returns an unsubscribe function.
 */
export function subscribe(root: Window | Element, cb: Listener): () => void {
	if (typeof window === 'undefined') return () => {};

	const entry = entries.get(root) ?? createEntry(root);
	entry.listeners.add(cb);

	return () => {
		entry.listeners.delete(cb);
		if (entry.listeners.size === 0) destroyEntry(entry);
	};
}
