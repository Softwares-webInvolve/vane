import { describe, it, expect } from 'vitest';
import {
	reduce,
	run,
	initialState,
	defaultConfig,
	type HysteresisConfig,
} from '../src/core/hysteresis';

const cfg = (over: Partial<HysteresisConfig> = {}): HysteresisConfig => ({
	...defaultConfig,
	...over,
});

/** Inclusive ramp of scroll positions, `step` px apart. */
const ramp = (from: number, to: number, step: number): number[] => {
	const out: number[] = [];
	const dir = to >= from ? 1 : -1;
	for (let y = from; dir > 0 ? y <= to : y >= to; y += step * dir) out.push(y);
	if (out[out.length - 1] !== to) out.push(to);
	return out;
};

// ───────────────────────────────────────────────────────────────────────────
// The headline proofs. These are the reason the reducer is pure.
// ───────────────────────────────────────────────────────────────────────────

describe('frame-rate independence', () => {
	it('60 samples of 1px and 1 sample of 60px reach the same state', () => {
		const slow = run([200, ...ramp(201, 260, 1)], cfg());
		const fast = run([200, 260], cfg());
		expect(slow.state).toBe('compact');
		expect(fast.state).toBe('compact');
		expect(slow.state).toBe(fast.state);
	});

	it('is identical across 30/60/120/144Hz sampling of the same gesture', () => {
		// One physical gesture: 200 → 800 → 400. Sampled at four rates.
		const gesture = (step: number) => [
			...ramp(200, 800, step),
			...ramp(800 - step, 400, step),
		];
		const states = [4, 8, 16, 32].map((step) => run(gesture(step), cfg()).state);
		expect(new Set(states).size).toBe(1);
		expect(states[0]).toBe('full'); // 400px of upward travel >> 24px threshold
	});

	it('a slow upward scroll re-expands — the react-headroom failure', () => {
		// react-headroom ships upTolerance: 5 and compares per-frame, so 3px/frame
		// never crosses it and the header stays hidden forever.
		const collapsed = run([200, 900], cfg());
		expect(collapsed.state).toBe('compact');

		let s = collapsed;
		for (const y of ramp(897, 850, 3)) {
			s = reduce(s, { y, maxY: 5000, viewport: 800, focusInside: false, keyboardFocus: false }, cfg());
		}
		expect(s.state).toBe('full');
	});
});

/**
 * The bug we are claiming to fix, implemented faithfully, so the difference is
 * demonstrated rather than asserted. If this ever starts passing, our claim is
 * wrong and the README needs changing.
 */
describe('the per-frame implementation (headroom.js / react-headroom / 21st.dev)', () => {
	const perFrame = (samples: number[], tolerance = 5) => {
		let last = samples[0] as number;
		let hidden = false;
		for (const y of samples.slice(1)) {
			const delta = y - last;
			if (y > 120 && delta > tolerance) hidden = true;
			else if (-delta > tolerance) hidden = false;
			last = y; // ← the bug
		}
		return hidden ? 'compact' : 'full';
	};

	it('fails to re-expand on a slow upward scroll', () => {
		const samples = [200, 900, ...ramp(897, 850, 3)];
		expect(perFrame(samples)).toBe('compact'); // stuck
		expect(run(samples, cfg()).state).toBe('full'); // ours recovers
	});

	it('gives different answers at different frame rates', () => {
		// Collapse first, then scroll back up the same physical distance at two
		// sampling rates. 20px/frame clears a tolerance of 5; 3px/frame does not.
		const gesture = (step: number) => [200, 900, ...ramp(900 - step, 840, step)];
		expect(perFrame(gesture(20))).toBe('full');
		expect(perFrame(gesture(3))).toBe('compact'); // stuck — same gesture, denser samples
		// Ours reaches the same state either way.
		expect(run(gesture(20), cfg()).state).toBe('full');
		expect(run(gesture(3), cfg()).state).toBe('full');
	});
});

// ───────────────────────────────────────────────────────────────────────────
// Guards
// ───────────────────────────────────────────────────────────────────────────

describe('guards', () => {
	it('clamps iOS rubber-band overscroll instead of reading it as a gesture', () => {
		// Bounce past the top and back. Unclamped this is a big upward run.
		const s = run([400, 900, 0, -40, -10, 0, 12], cfg(), { maxY: 5000 });
		expect(s.state).toBe('full'); // correct, but via the offset rule
		expect(s.lastY).toBeGreaterThanOrEqual(0); // never negative
	});

	it('does not let bottom overscroll invent downward travel', () => {
		const s = run([100, 150, 200, 260, 340], cfg({ offset: 0 }), { maxY: 200, viewport: 800 });
		expect(s.lastY).toBe(200); // clamped to maxY
	});

	it('treats an anchor jump as a teleport, not travel', () => {
		const s = run([300, 4000], cfg(), { viewport: 800 });
		expect(s.dir).toBe(0);
		expect(s.anchorY).toBe(4000);
		expect(s.state).toBe('full'); // no spurious collapse from the jump
	});

	it('a teleport above the offset lands full', () => {
		const s = run([3000, 10], cfg(), { viewport: 800 });
		expect(s.state).toBe('full');
	});
});

// ───────────────────────────────────────────────────────────────────────────
// State machine behaviour
// ───────────────────────────────────────────────────────────────────────────

describe('transitions', () => {
	it('stays full below the offset regardless of travel', () => {
		expect(run(ramp(0, 119, 1), cfg({ offset: 120 })).state).toBe('full');
	});

	it('needs a full threshold of NEW travel after each reversal', () => {
		const c = cfg({ thresholdUp: 24, thresholdDown: 24 });
		let s = run([200, 700], c); // down 500
		expect(s.state).toBe('compact');

		// up 23 — one short
		for (const y of ramp(699, 677, 1)) {
			s = reduce(s, { y, maxY: 9000, viewport: 800, focusInside: false, keyboardFocus: false }, c);
		}
		expect(s.state).toBe('compact');

		// the 24th px
		s = reduce(s, { y: 676, maxY: 9000, viewport: 800, focusInside: false, keyboardFocus: false }, c);
		expect(s.state).toBe('full');
	});

	it('round-trips symmetrically: down → up → down', () => {
		const c = cfg();
		expect(run([200, 700], c).state).toBe('compact');
		expect(run([200, 700, 660], c).state).toBe('full');
		expect(run([200, 700, 660, 700], c).state).toBe('compact');
	});

	it('honours asymmetric thresholds', () => {
		const c = cfg({ thresholdDown: 100, thresholdUp: 8 });
		expect(run([200, 260], c).state).toBe('full'); // 60 < 100
		expect(run([200, 320], c).state).toBe('compact'); // 120 >= 100
		expect(run([200, 320, 310], c).state).toBe('full'); // 10 >= 8
	});

	it('collapseTo: hidden produces the hidden state', () => {
		expect(run([200, 900], cfg({ collapseTo: 'hidden' })).state).toBe('hidden');
	});

	it('returns the same object reference when nothing changed', () => {
		const c = cfg();
		const a = initialState(500);
		const b = reduce(a, { y: 500, maxY: 9000, viewport: 800, focusInside: false, keyboardFocus: false }, c);
		expect(b).toBe(a);
	});

	it('survives 1px jitter around a threshold boundary without oscillating', () => {
		const c = cfg({ thresholdDown: 24, thresholdUp: 24 });
		let s = initialState(500);
		let flips = 0;
		let last = s.state;
		for (let i = 0; i < 40; i++) {
			const y = 500 + (i % 2 === 0 ? 1 : -1);
			s = reduce(s, { y, maxY: 9000, viewport: 800, focusInside: false, keyboardFocus: false }, c);
			if (s.state !== last) flips++;
			last = s.state;
		}
		expect(flips).toBe(0);
	});
});

// ───────────────────────────────────────────────────────────────────────────
// Keyboard focus deferral — the feature the headline claim rests on
// ───────────────────────────────────────────────────────────────────────────

describe('focus deferral', () => {
	const kb = { focusInside: true, keyboardFocus: true, maxY: 9000, viewport: 800 };

	it('defers collapse while a keyboard user is inside the nav', () => {
		const s = run([200, 500], cfg({ focusDeferDistance: 400 }), kb);
		expect(s.state).toBe('full');
	});

	it('collapses anyway once the defer distance is exceeded', () => {
		const s = run([200, 800], cfg({ focusDeferDistance: 400 }), kb);
		expect(s.state).toBe('compact');
	});

	it('the deferral is itself frame-rate independent', () => {
		const c = cfg({ focusDeferDistance: 400 });
		const gesture = (step: number) => [200, ...ramp(200 + step, 700, step)];
		expect(run(gesture(2), c, kb).state).toBe(run(gesture(50), c, kb).state);
		expect(run(gesture(2), c, kb).state).toBe('compact'); // 500 travel >= 400
	});

	it('measures defer distance as travel, not absolute position', () => {
		// Deep-linked to y=5000, then scrolls 100px. Absolute-cutoff logic
		// (the original nav-bar.jsx used `y <= 420`) collapses immediately here.
		const s = run([5000, 5100], cfg({ focusDeferDistance: 400 }), kb);
		expect(s.state).toBe('full');
	});

	it('does not defer for pointer focus', () => {
		const s = run([200, 500], cfg({ focusDeferDistance: 400 }), {
			...kb,
			keyboardFocus: false,
		});
		expect(s.state).toBe('compact');
	});

	it('focusDeferDistance: 0 disables deferral', () => {
		expect(run([200, 500], cfg({ focusDeferDistance: 0 }), kb).state).toBe('compact');
	});

	it('focusDeferDistance: Infinity never collapses while focused', () => {
		expect(run([200, 8000], cfg({ focusDeferDistance: Infinity }), kb).state).toBe('full');
	});
});
