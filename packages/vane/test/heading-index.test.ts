import { describe, it, expect } from 'vitest';
import {
	select,
	selectFromTops,
	planesFromTops,
	resolveReadingLine,
	defaultGetLabel,
	initialSpyState,
} from '../src/core/heading-index';

/** Scroll a set of marker tops through the reading line and record the answer. */
const scrollThrough = (
	frames: number[][],
	readingLine: number,
	band: number,
	sticky = true,
) => {
	let s = initialSpyState();
	const seen: number[] = [];
	for (const tops of frames) {
		s = select(s, planesFromTops(tops, readingLine, band), sticky);
		seen.push(s.active);
	}
	return { final: s.active, seen };
};

// ───────────────────────────────────────────────────────────────────────────
// The Mantine failure
// ───────────────────────────────────────────────────────────────────────────

describe('signed selection', () => {
	const L = 200;

	it('a heading just BELOW the line loses to one far above', () => {
		// Section A's heading is 600px above the line — you are reading A.
		// Section B's heading is 40px below — B has not started.
		const tops = [-400, 240];
		expect(selectFromTops(tops, L)).toBe(0);
	});

	it('is what Mantine gets wrong', () => {
		// argmin |top - L|, the unsigned rule, picks the nearer one: B.
		const tops = [-400, 240];
		const mantine = tops
			.map((t, i) => [Math.abs(t - L), i] as const)
			.sort((a, b) => a[0] - b[0])[0]![1];
		expect(mantine).toBe(1); // wrong
		expect(selectFromTops(tops, L)).toBe(0); // right
	});

	it('a marker exactly on the line counts as entered', () => {
		expect(selectFromTops([-100, 200, 400], 200)).toBe(1);
	});

	it('resolves -1 before the first heading', () => {
		expect(selectFromTops([300, 700], 200)).toBe(-1);
	});

	it('picks the last passed marker, not the nearest', () => {
		expect(selectFromTops([-900, -600, -20, 500], 200)).toBe(2);
	});
});

// ───────────────────────────────────────────────────────────────────────────
// Oscillation — the reason for the Schmitt trigger
// ───────────────────────────────────────────────────────────────────────────

describe('hysteresis', () => {
	const L = 200;
	const band = 24;

	it('±3px jitter across the line produces at most one transition', () => {
		const frames: number[][] = [];
		for (let i = 0; i < 20; i++) {
			frames.push([-500, L + (i % 2 === 0 ? 3 : -3)]);
		}
		const { seen } = scrollThrough(frames, L, band);
		const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
		expect(flips).toBeLessThanOrEqual(1);
	});

	it('a band of 0 has no hysteresis (opt-out works)', () => {
		const frames: number[][] = [];
		for (let i = 0; i < 10; i++) frames.push([-500, L + (i % 2 === 0 ? 3 : -3)]);
		const { seen } = scrollThrough(frames, L, 0);
		const flips = seen.filter((v, i) => i > 0 && v !== seen[i - 1]).length;
		expect(flips).toBeGreaterThan(1); // oscillates, as expected without a band
	});

	it('still advances on a fast scroll that skips the band entirely', () => {
		// Two frames only: the marker is well below, then well above. A thin-band
		// observer would report not-intersecting on both and miss the crossing.
		const { final } = scrollThrough([[-500, 900], [-500, -900]], L, band);
		expect(final).toBe(1);
	});

	it('skipping several sections in one frame lands on the last one', () => {
		const { final } = scrollThrough(
			[[500, 900, 1300, 1700], [-1400, -1000, -600, -200]],
			L,
			band,
		);
		expect(final).toBe(3);
	});

	it('retreats when scrolling back up', () => {
		const { final } = scrollThrough(
			[[-900, -400], [-900, -400], [-900, 600]],
			L,
			band,
		);
		expect(final).toBe(0);
	});

	it('advance requires crossing the upper edge, retreat the lower edge', () => {
		// Inside the band from below: not yet advanced.
		let s = initialSpyState();
		s = select(s, planesFromTops([-500, L + 5], L, 40)); // within band
		expect(s.active).toBe(0);
		// Past the upper edge: advances.
		s = select(s, planesFromTops([-500, L - 25], L, 40));
		expect(s.active).toBe(1);
		// Back inside the band: holds.
		s = select(s, planesFromTops([-500, L + 5], L, 40));
		expect(s.active).toBe(1);
		// Past the lower edge: retreats.
		s = select(s, planesFromTops([-500, L + 25], L, 40));
		expect(s.active).toBe(0);
	});

	it('returns the same object when the answer is unchanged', () => {
		const a = initialSpyState();
		const planes = planesFromTops([500], 200, 24);
		const b = select(a, planes);
		expect(b).toBe(a);
	});
});

describe('sticky', () => {
	it('keeps the last section when scrolling above the first heading', () => {
		const { final } = scrollThrough([[-400], [400]], 200, 24, true);
		expect(final).toBe(0);
	});

	it('clears it when sticky is off', () => {
		const { final } = scrollThrough([[-400], [400]], 200, 24, false);
		expect(final).toBe(-1);
	});
});

// ───────────────────────────────────────────────────────────────────────────
// Inputs
// ───────────────────────────────────────────────────────────────────────────

describe('resolveReadingLine', () => {
	it('treats 0..1 as a fraction of the viewport', () => {
		expect(resolveReadingLine(0.3, 1000)).toBe(300);
		expect(resolveReadingLine(1, 1000)).toBe(1000);
	});
	it('treats larger numbers as px', () => {
		expect(resolveReadingLine(160, 1000)).toBe(160);
	});
	it('accepts a px string', () => {
		expect(resolveReadingLine('96px', 1000)).toBe(96);
	});
	it('accepts a function, for nav-height-relative lines', () => {
		expect(resolveReadingLine(() => 64 + 0.2 * 1000, 1000)).toBe(264);
	});
});

describe('defaultGetLabel', () => {
	const el = (html: string) => {
		const d = { dataset: {} as Record<string, string>, textContent: html };
		return d as unknown as Element;
	};

	it('uses textContent, collapsing whitespace', () => {
		expect(defaultGetLabel(el('  What   we\n do '))).toBe('What we do');
	});

	it('prefers data-vane-label', () => {
		const e = el('A very long marketing headline');
		(e as unknown as HTMLElement).dataset.vaneLabel = 'Services';
		expect(defaultGetLabel(e)).toBe('Services');
	});

	it('falls through to textContent when the attribute is empty', () => {
		// An empty attribute is a templating accident, not "show nothing".
		const e = el('Services');
		(e as unknown as HTMLElement).dataset.vaneLabel = '   ';
		expect(defaultGetLabel(e)).toBe('Services');
	});
});
