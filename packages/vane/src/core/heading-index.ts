/**
 * Which section am I reading?
 *
 * Pure selection logic over an ordered set of marker positions. No DOM, no
 * observers — `observers.ts` feeds this the membership sets that
 * IntersectionObserver produces, and this decides the answer.
 *
 * ── Two decisions worth explaining ─────────────────────────────────────────
 *
 * 1. SIGNED SELECTION. Mantine's `use-scroll-spy` picks the heading with the
 *    minimum *absolute* distance to the reading line:
 *
 *        argmin |rect.y - offset|
 *
 *    Being unsigned, a heading 10px BELOW the line beats the section you are
 *    actually reading 600px above it — the label names a section that has not
 *    started yet. We instead take the last marker you have scrolled past:
 *
 *        the highest-index marker whose top <= the reading line
 *
 *    Markers below the line are never candidates.
 *
 * 2. HYSTERESIS VIA TWO HALF-PLANES, NOT A BAND. The obvious way to debounce
 *    is a thin IntersectionObserver band around the reading line. That is
 *    subtly broken: a marker that traverses the whole band between two
 *    observer deliveries reports `isIntersecting: false` on both sides, so the
 *    crossing is silently lost and the label sticks. It fails exactly when
 *    scrolling fast, which is when people notice.
 *
 *    With two half-plane observers at L±band/2, `isIntersecting` is a position
 *    predicate ("is this marker above the line") rather than an event, so it
 *    cannot be missed regardless of delivery timing. Because
 *    L-band/2 < L+band/2, the advance set is always a subset of the retreat
 *    set, and the pair forms a Schmitt trigger over the ordered markers.
 *
 * The upshot is no debounce timer anywhere. The navbar this was extracted from
 * used a 150ms `setTimeout` to hide ratio-based oscillation; removing the cause
 * makes the label both instant and stable.
 */

export interface Marker {
	/** Document order. Must be ascending and contiguous from 0. */
	index: number;
	/** The marker's own id, or the nearest ancestor's, or undefined. */
	id: string | undefined;
	label: string;
}

export interface SpyState {
	/** Index of the active marker, or -1 for none resolved yet. */
	active: number;
}

/**
 * Membership sets produced by the two half-plane observers.
 *
 * `aboveAdvance` — markers above the line's upper edge (L - band/2).
 * `aboveRetreat` — markers above the line's lower edge (L + band/2).
 *
 * Invariant: aboveAdvance ⊆ aboveRetreat.
 */
export interface HalfPlanes {
	aboveAdvance: ReadonlySet<number>;
	aboveRetreat: ReadonlySet<number>;
}

export const initialSpyState = (): SpyState => ({ active: -1 });

const maxOf = (s: ReadonlySet<number>): number => {
	let m = -1;
	for (const v of s) if (v > m) m = v;
	return m;
};

/**
 * Advance the spy by one observer delivery.
 *
 * Returns the same object reference when the answer did not change, so callers
 * can use identity to skip re-renders.
 */
export function select(prev: SpyState, planes: HalfPlanes, sticky = true): SpyState {
	const candidateAdvance = maxOf(planes.aboveAdvance);
	const candidateRetreat = maxOf(planes.aboveRetreat);

	let active = prev.active;

	if (candidateAdvance > active) {
		// Firmly past a later marker — move forward.
		active = candidateAdvance;
	} else if (candidateRetreat < active) {
		// Firmly back before the current marker — move back. Using the retreat
		// (lower) edge here is what makes this a Schmitt trigger: the position
		// that un-selects a marker is below the one that selected it, so jitter
		// across the line cannot toggle the answer.
		//
		// `sticky` is the one exception: retreating all the way to "nothing
		// selected" would blank the label whenever the reader scrolls back above
		// the first heading, which reads as a bug. Hold the first section
		// instead. Retreats between real sections are unaffected.
		if (!(sticky && candidateRetreat === -1)) active = candidateRetreat;
	}

	return active === prev.active ? prev : { active };
}

/**
 * Resolve the active marker from raw geometry.
 *
 * Only used for the initial synchronous resolve, before the observers have
 * delivered anything, and on explicit `refresh()`. The steady-state path never
 * measures — that is the point of the observers.
 */
export function selectFromTops(tops: readonly number[], readingLine: number): number {
	let active = -1;
	for (let i = 0; i < tops.length; i++) {
		// `<=` so a marker sitting exactly on the line counts as entered.
		if ((tops[i] as number) <= readingLine) active = i;
		else break; // tops are in document order; everything after is below
	}
	return active;
}

/**
 * Derive half-plane sets from raw geometry. Used by the unit tests to exercise
 * `select` without a browser, and by `refresh()`.
 */
export function planesFromTops(
	tops: readonly number[],
	readingLine: number,
	band: number,
): HalfPlanes {
	const upper = readingLine - band / 2;
	const lower = readingLine + band / 2;
	const aboveAdvance = new Set<number>();
	const aboveRetreat = new Set<number>();
	for (let i = 0; i < tops.length; i++) {
		const t = tops[i] as number;
		if (t <= upper) aboveAdvance.add(i);
		if (t <= lower) aboveRetreat.add(i);
	}
	return { aboveAdvance, aboveRetreat };
}

/** Resolve the reading line, in px from the top of the scroll root. */
export function resolveReadingLine(
	readingLine: number | `${number}px` | (() => number),
	viewportHeight: number,
): number {
	if (typeof readingLine === 'function') return readingLine();
	if (typeof readingLine === 'string') return parseFloat(readingLine);
	// A bare number 0..1 is a fraction of the viewport; anything larger is px.
	return readingLine <= 1 ? readingLine * viewportHeight : readingLine;
}

/**
 * Default label extraction: an explicit `data-vane-label` wins, otherwise the
 * marker's own text.
 *
 * Empty `data-vane-label=""` deliberately falls through to textContent rather
 * than producing a blank label — an empty attribute is almost always a
 * templating accident, not an instruction to show nothing.
 */
export function defaultGetLabel(el: Element): string {
	const attr = (el as HTMLElement).dataset?.vaneLabel?.trim();
	if (attr) return attr;
	return (el.textContent ?? '').trim().replace(/\s+/g, ' ');
}
