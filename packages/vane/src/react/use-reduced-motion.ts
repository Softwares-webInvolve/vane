import { useSyncExternalStore } from 'react';
import { getServerSnapshot, getSnapshot, subscribe } from '../core/media';

const QUERY = '(prefers-reduced-motion: reduce)';

export type ReducedMotionMode = 'user' | 'always' | 'never';

/**
 * `'always'`/`'never'` are overrides for consumers who need to force a
 * value (tests, a settings toggle) without fighting the OS setting. `'user'`
 * — the default — is a live subscription, not a one-time read; see
 * `core/media.ts` for why that distinction matters.
 */
export function useReducedMotion(mode: ReducedMotionMode = 'user'): boolean {
	const system = useSyncExternalStore(
		(onChange) => subscribe(QUERY, onChange),
		() => getSnapshot(QUERY),
		getServerSnapshot,
	);

	if (mode === 'always') return true;
	if (mode === 'never') return false;
	return system;
}
