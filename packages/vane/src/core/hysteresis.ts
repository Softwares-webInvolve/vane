/**
 * The scroll state machine.
 *
 * A pure reducer: `(state, sample, config) => state`. No DOM, no React, no time.
 * Everything that makes the nav collapse or expand is decided here, which is why
 * the frame-rate-independence proofs in test/hysteresis.test.ts are table tests
 * over arrays of numbers rather than browser tests.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Every implementation we audited — headroom.js, react-headroom, 21st.dev's
 * morphing navbar, and the navbar this package was extracted from — does this:
 *
 *     const delta = y - lastScrollY;
 *     if (delta > tolerance) collapse();
 *     lastScrollY = y;              // ← reassigned on EVERY sample
 *
 * `delta` is then the distance travelled in one animation frame, which is
 * *velocity*, not displacement. Two consequences, both real bugs:
 *
 *   1. Frame-rate dependent. At 120Hz each frame covers half the ground, so the
 *      same physical gesture produces half the delta and may never cross the
 *      threshold. The component behaves differently on different monitors.
 *   2. A slow scroll up never restores the nav. react-headroom ships
 *      `upTolerance: 5` by default, so scrolling up at 5px/frame or less
 *      (~300px/s at 60Hz — an ordinary careful scroll) leaves the header hidden
 *      indefinitely.
 *
 * We measure cumulative displacement since the last direction reversal instead.
 */

export type MorphState = 'full' | 'compact' | 'hidden';
export type Direction = 'up' | 'down' | 'none';

/** -1 up, +1 down, 0 undetermined (only at rest or after a teleport). */
export type Sign = -1 | 0 | 1;

export interface HysteresisConfig {
	/** Below this scroll position the nav is always `full`. */
	offset: number;
	/** Cumulative px of upward travel since reversal required to expand. */
	thresholdUp: number;
	/** Cumulative px of downward travel since reversal required to collapse. */
	thresholdDown: number;
	/** What "collapsed" means for this instance. */
	collapseTo: 'compact' | 'hidden';
	/**
	 * How much further a keyboard user may scroll down before we collapse
	 * anyway. 0 disables deferral; Infinity never collapses while focused.
	 */
	focusDeferDistance: number;
}

export interface HysteresisState {
	state: MorphState;
	/** The committed direction of the current run. */
	dir: Sign;
	/** Scroll position at the extremum where the current run began. */
	anchorY: number;
	/** Previous sample. Used only to derive the instantaneous sign. */
	lastY: number;
}

export interface Sample {
	/** Raw scroll position. May be out of range during iOS rubber-band. */
	y: number;
	/** `scrollHeight - clientHeight` of the scroll root. */
	maxY: number;
	/** Viewport height of the scroll root, for teleport detection. */
	viewport: number;
	/** Focus is currently inside the nav. */
	focusInside: boolean;
	/** That focus arrived via keyboard (`:focus-visible`). */
	keyboardFocus: boolean;
}

export const initialState = (y = 0): HysteresisState => ({
	state: 'full',
	dir: 0,
	anchorY: y,
	lastY: y,
});

export const directionOf = (dir: Sign): Direction =>
	dir === 1 ? 'down' : dir === -1 ? 'up' : 'none';

const clamp = (n: number, lo: number, hi: number) =>
	n < lo ? lo : n > hi ? hi : n;

/**
 * Advance the machine by one scroll sample.
 *
 * Returns the SAME object reference when nothing changed, so callers can use
 * identity as a cheap "should I re-render?" check.
 */
export function reduce(
	prev: HysteresisState,
	sample: Sample,
	config: HysteresisConfig,
): HysteresisState {
	const { offset, thresholdUp, thresholdDown, collapseTo, focusDeferDistance } = config;
	const collapsed: MorphState = collapseTo;

	// iOS rubber-band pushes y negative at the top and past maxY at the bottom.
	// Unclamped, the bounce-back reads as a large genuine upward run and the nav
	// spuriously expands. Clamp before the machine ever sees it.
	const y = clamp(sample.y, 0, Math.max(0, sample.maxY));

	// A jump of more than two viewports in one sample is an anchor link,
	// scroll restoration or scripted scrollTo — not a gesture. Treating it as
	// travel makes the nav flash when someone clicks a table-of-contents link.
	// Re-anchor and decide purely on position.
	if (Math.abs(y - prev.lastY) > 2 * sample.viewport && sample.viewport > 0) {
		const state = y <= offset ? 'full' : prev.state;
		if (state === prev.state && y === prev.lastY && prev.dir === 0) return prev;
		return { state, dir: 0, anchorY: y, lastY: y };
	}

	// Above the offset the nav is unconditionally full. Reset the run so the
	// first push downward from the top needs a complete threshold of travel.
	if (y <= offset) {
		if (prev.state === 'full' && prev.lastY === y && prev.dir === 0) return prev;
		return { state: 'full', dir: 0, anchorY: y, lastY: y };
	}

	if (y === prev.lastY) return prev;

	const sign: Sign = y > prev.lastY ? 1 : -1;

	// On reversal, re-anchor at the extremum just reached — which is `lastY`,
	// the final sample of the *previous* run, not `y`. Anchoring at `y` throws
	// away the first sample of the new run; at 120Hz that is a meaningful slice
	// of a 24px threshold and smuggles frame-rate sensitivity back in.
	let { dir, anchorY } = prev;
	if (sign !== dir) {
		dir = sign;
		anchorY = prev.lastY;
	}

	const travel = Math.abs(y - anchorY);
	let state = prev.state;

	// Collapsing the nav out from under someone who is tabbing through it loses
	// their place, so a keyboard-focused user simply gets a larger threshold.
	//
	// Expressing the grace as a threshold rather than as a separate "defer
	// anchor" matters: both are then measured from the same extremum, so the
	// deferral inherits the machine's frame-rate independence for free. An
	// independent anchor set at whichever sample happened to cross the
	// threshold would reintroduce exactly the sampling dependence this module
	// exists to remove.
	//
	// It is also travel, not absolute position. The navbar this was extracted
	// from used `scrollY <= 420`, which behaves differently for someone who
	// deep-linked into the middle of a page and is meaningless when the nav
	// lives inside a scroll container.
	const deferring = sample.focusInside && sample.keyboardFocus && focusDeferDistance > 0;
	const downThreshold = deferring ? Math.max(thresholdDown, focusDeferDistance) : thresholdDown;

	if (dir === 1 && prev.state === 'full' && travel >= downThreshold) {
		state = collapsed;
	} else if (dir === -1 && prev.state !== 'full' && travel >= thresholdUp) {
		state = 'full';
	}

	return { state, dir, anchorY, lastY: y };
}

/**
 * Feed a whole array of positions through the machine. Used by the tests and by
 * the docs' interactive explainer; not part of the runtime path.
 */
export function run(
	samples: number[],
	config: HysteresisConfig,
	opts: { maxY?: number; viewport?: number; focusInside?: boolean; keyboardFocus?: boolean } = {},
): HysteresisState {
	const {
		maxY = Number.MAX_SAFE_INTEGER,
		viewport = 800,
		focusInside = false,
		keyboardFocus = false,
	} = opts;
	let state = initialState(samples[0] ?? 0);
	for (const y of samples) {
		state = reduce(state, { y, maxY, viewport, focusInside, keyboardFocus }, config);
	}
	return state;
}

export const defaultConfig: HysteresisConfig = {
	offset: 120,
	thresholdUp: 24,
	thresholdDown: 24,
	collapseTo: 'compact',
	focusDeferDistance: 400,
};
