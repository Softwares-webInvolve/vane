import { useEffect, useRef, useState, type RefObject } from 'react';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Observes an arbitrary set of elements with a SINGLE ResizeObserver and
 * hands each entry's border-box size to a callback, rounded to 2dp.
 *
 * Exists so `use-nav-morph.ts` can fold its width measurement (the
 * GATE1-forced measured-width path) into the very same observer instance
 * this hook uses for height, rather than paying for a second RO doing
 * fundamentally the same kind of work. `useNavHeight` itself is just the
 * single-target special case.
 */
export function observeMetrics(
	targets: ReadonlyArray<Element | null | undefined>,
	onEntry: (target: Element, size: { width: number; height: number }) => void,
): () => void {
	if (typeof ResizeObserver === 'undefined') return () => {};

	const ro = new ResizeObserver((entries) => {
		for (const entry of entries) {
			const box = entry.borderBoxSize?.[0];
			const width = box ? box.inlineSize : entry.contentRect.width;
			const height = box ? box.blockSize : entry.contentRect.height;
			onEntry(entry.target, { width: round2(width), height: round2(height) });
		}
	});

	for (const target of targets) {
		if (target) ro.observe(target, { box: 'border-box' });
	}

	return () => ro.disconnect();
}

export interface UseNavHeightOptions {
	/** Custom property name to publish. */
	heightVar?: string;
	/** Element the custom property is written to. Defaults to `documentElement`. */
	root?: HTMLElement | null;
}

/**
 * Publishes `--vane-height` (and `--vane-height-max`) from the nav's live
 * border-box height.
 *
 * Bailing when the rounded height is unchanged is what makes this free
 * during the collapse transition: without it, every intermediate frame of a
 * height-affecting transition would write to a custom property on `:root`,
 * which is exactly the kind of style write RO callbacks are supposed to let
 * you avoid (they run after layout, before paint — a write here cannot
 * trigger another RO delivery in the same pass, but it still isn't free).
 */
export function useNavHeight(
	navRef: RefObject<HTMLElement | null>,
	options: UseNavHeightOptions = {},
): number {
	const { heightVar = '--vane-height', root = null } = options;
	const [height, setHeight] = useState(0);
	const maxHeightRef = useRef(0);
	const lastHeightRef = useRef<number | null>(null);

	useEffect(() => {
		const nav = navRef.current;
		if (!nav) return;

		const target = root ?? document.documentElement;

		const apply = (h: number) => {
			if (lastHeightRef.current === h) return;
			lastHeightRef.current = h;
			target.style.setProperty(heightVar, `${h}px`);
			// Mirrored on the nav itself so descendants can read it without a
			// selector that reaches all the way up to `:root`.
			nav.style.setProperty(heightVar, `${h}px`);
			if (h > maxHeightRef.current) {
				maxHeightRef.current = h;
				target.style.setProperty(`${heightVar}-max`, `${h}px`);
			}
			setHeight(h);
		};

		apply(round2(nav.getBoundingClientRect().height));

		return observeMetrics([nav], (_el, size) => apply(size.height));
	}, [navRef, heightVar, root]);

	return height;
}
