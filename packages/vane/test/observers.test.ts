import { describe, it, expect } from 'vitest';
import { computeRootMargin } from '../src/core/observers';

describe('computeRootMargin', () => {
	it('shrinks the bottom to sit exactly at the requested edge', () => {
		// viewport 800, edge 240 -> bottom inset must be 560, i.e. rootMargin
		// bottom of -560px places the root's effective bottom at y=240.
		const margin = computeRootMargin(240, 800, 100_000);
		expect(margin).toBe('8000px 0px -560px 0px');
	});

	it('clamps the top expansion to ten viewports on very long documents', () => {
		const margin = computeRootMargin(0, 800, 1_000_000);
		expect(margin).toBe('8000px 0px -800px 0px');
	});

	it('does not clamp when the document is shorter than ten viewports', () => {
		const margin = computeRootMargin(400, 800, 2000);
		expect(margin).toBe('2000px 0px -400px 0px');
	});

	it('advance edge (L - band/2) sits above the retreat edge (L + band/2)', () => {
		const line = 300;
		const band = 20;
		const advance = computeRootMargin(line - band / 2, 800, 5000);
		const retreat = computeRootMargin(line + band / 2, 800, 5000);
		// A larger bottom inset means the effective cut is HIGHER on the page,
		// which is what "advance requires firmly past" needs relative to retreat.
		const advanceBottomInset = -parseFloat(advance.split(' ')[2] ?? '0');
		const retreatBottomInset = -parseFloat(retreat.split(' ')[2] ?? '0');
		expect(advanceBottomInset).toBeGreaterThan(retreatBottomInset);
	});
});
