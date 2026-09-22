/**
 * Feature detection, memoised.
 *
 * Every check here must survive being imported during a server render:
 * `document`, `CSS` and `HTMLElement` do not exist in Node, and evaluating
 * any of them eagerly at module scope would crash the whole page render, not
 * just the nav. Everything is deferred to first call and guarded.
 *
 * The SSR result is deliberately NOT cached into the memo slot — only a real
 * (client) answer is. Otherwise the first call during a server render would
 * permanently freeze `false` for the lifetime of the module, and a later
 * client-side call (same module instance under some bundler setups) would
 * never re-check.
 */

let inert: boolean | undefined;
let scrollTimeline: boolean | undefined;
let interpolateSize: boolean | undefined;

export function supportsInert(): boolean {
	if (inert !== undefined) return inert;
	if (typeof document === 'undefined') return false;
	inert = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;
	return inert;
}

export function supportsScrollTimeline(): boolean {
	if (scrollTimeline !== undefined) return scrollTimeline;
	if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
	try {
		scrollTimeline = CSS.supports('animation-timeline', 'scroll()');
	} catch {
		scrollTimeline = false;
	}
	return scrollTimeline;
}

export function supportsInterpolateSize(): boolean {
	if (interpolateSize !== undefined) return interpolateSize;
	if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false;
	try {
		interpolateSize = CSS.supports('interpolate-size', 'allow-keywords');
	} catch {
		interpolateSize = false;
	}
	return interpolateSize;
}
