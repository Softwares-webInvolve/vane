import { describe, it, expect } from 'vitest';
import { normalizeThreshold } from '../src/react/use-nav-morph';

describe('normalizeThreshold', () => {
	const fallback = { up: 24, down: 24 };

	it('falls back to the default when omitted', () => {
		expect(normalizeThreshold(undefined, fallback)).toEqual(fallback);
	});

	it('applies a bare number symmetrically', () => {
		expect(normalizeThreshold(40, fallback)).toEqual({ up: 40, down: 40 });
	});

	it('passes an explicit {up, down} through unchanged', () => {
		expect(normalizeThreshold({ up: 10, down: 60 }, fallback)).toEqual({ up: 10, down: 60 });
	});
});
