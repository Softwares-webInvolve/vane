'use client';

import { useEffect, useState } from 'react';

interface LiveState {
	state: string;
	direction: string;
	height: string;
}

const EMPTY: LiveState = { state: '—', direction: '—', height: '—' };

/**
 * Reads the actual published DOM/CSS contract (`[data-vane]`'s
 * `data-state`/`data-direction`, `--vane-height` on `documentElement`)
 * rather than a second `useNavMorph()` call — this is a debugging aid for
 * the *public* contract, so it should observe exactly what a consumer's own
 * CSS or JS would see, not React-internal state a second hook instance
 * would recompute independently.
 */
export function LiveStatePanel() {
	const [live, setLive] = useState<LiveState>(EMPTY);

	useEffect(() => {
		let raf = 0;
		let last = '';

		const tick = () => {
			const nav = document.querySelector('[data-vane]');
			const state = nav?.getAttribute('data-state') ?? '—';
			const direction = nav?.getAttribute('data-direction') ?? '—';
			const height = getComputedStyle(document.documentElement).getPropertyValue('--vane-height').trim() || '—';

			const next = `${state}|${direction}|${height}`;
			if (next !== last) {
				last = next;
				setLive({ state, direction, height });
			}
			raf = requestAnimationFrame(tick);
		};

		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	return (
		<dl className="state-panel" aria-live="polite">
			<dt>state</dt>
			<dd>{live.state}</dd>
			<dt>direction</dt>
			<dd>{live.direction}</dd>
			<dt>--vane-height</dt>
			<dd>{live.height}</dd>
		</dl>
	);
}
