/**
 * `matchMedia` as a `useSyncExternalStore`-shaped external store.
 *
 * The bug this file exists to prevent: reading `matchMedia(query).matches`
 * once at mount and never again. A user flipping the OS reduced-motion
 * setting mid-session — or a test flipping `emulateMedia` after load — gets
 * ignored unless something is actually listening for `change`.
 */

export function subscribe(query: string, onChange: () => void): () => void {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return () => {};
	}
	const mql = window.matchMedia(query);
	// Safari < 14 only has the deprecated addListener/removeListener pair.
	if (typeof mql.addEventListener === 'function') {
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	}
	mql.addListener(onChange);
	return () => mql.removeListener(onChange);
}

export function getSnapshot(query: string): boolean {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
	return window.matchMedia(query).matches;
}

/** SSR is always the non-reduced-motion, non-collapsed default state. */
export function getServerSnapshot(): boolean {
	return false;
}
