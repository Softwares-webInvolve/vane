export interface Section {
	id: string;
	heading: string;
	/** Overrides the auto-derived nav label for this heading via
	 * `data-vane-label` — the honest escape hatch for a heading that reads
	 * well on the page but badly in a 4-word nav pill. */
	labelOverride?: string;
	paragraphs: string[];
}

export const sections: Section[] = [
	{
		id: 'quick-start',
		heading: 'Quick start',
		paragraphs: [
			'Install the package, wrap your links in <Vane>, and add one line of CSS. There is no `items` array — you bring your own `<a>` or `next/link`, which is the only way this stays router-agnostic.',
			'`html { scroll-padding-top: calc(var(--vane-height, 4rem) + 1rem); }` is the whole reason this ships a height variable at all: without it, clicking any of the links in the sidebar lands the target section under the nav.',
		],
	},
	{
		id: 'not-scrollspy',
		heading: "Isn't this just scrollspy?",
		paragraphs: [
			'Mostly, yes — auto-deriving a label from headings is not new. What is different is the selection rule: most implementations pick the heading nearest the reading line by absolute distance, which means a heading just below the line can beat the section you are actually 600px into reading.',
			'This one picks the highest-index heading whose top has already crossed the line. Headings below the line are never candidates, so the label never jumps ahead of where you are.',
		],
	},
	{
		id: 'focus-correctness',
		heading: "The tab-order problem nobody else fixed",
		labelOverride: 'Tab order',
		paragraphs: [
			'Four scroll-aware navbars were checked, and every one of them that hides or collapses navigation leaves the hidden links in the tab order. `opacity: 0` and `translateY(-100%)` are both cosmetic — a keyboard user tabbing through the page still lands on links they cannot see.',
			'`<Vane.Full>` and `<Vane.Compact>` are made properly `inert` (the IDL property, set imperatively, never `inert=""` from JSX — React 18 and 19 disagree about what that means) the moment they stop being the visible region. Tab order and paint stay in sync.',
		],
	},
	{
		id: 'height-contract',
		heading: 'Publishing --vane-height',
		paragraphs: [
			'A `ResizeObserver` on the nav writes its live border-box height to `--vane-height` on `documentElement`, rounded to two decimal places, bailing when the rounded value has not changed — so a height-affecting transition does not spam style writes on every intermediate frame.',
			'`--vane-height-max` is published alongside it for anything that wants a no-overlap guarantee without reacting to every collapse and expand.',
		],
	},
	{
		id: 'css-js-split',
		heading: 'What CSS owns vs what JS owns',
		paragraphs: [
			'Scroll-driven animations made the elevation ramp and the reading-progress hairline a pure-CSS problem in Chromium and WebKit — both run off the main thread via `animation-timeline`, with a binary `[data-scrolled]` fallback for Firefox that costs nothing extra because the same scroll source already drives direction.',
			'The full-to-compact width morph looked like it should be CSS-only too. It measurably is not: `grid-template-columns: 1fr → 0fr` inside a `fit-content` container does not animate the width at all, in any engine — `fr` tracks resolve against available space, and a shrink-to-fit box has none. The fix ships here as a transition between two *measured* lengths instead.',
		],
	},
	{
		id: 'reduced-motion',
		heading: 'Reduced motion, done right',
		paragraphs: [
			'`--vane-duration` drops to `0.01ms` under `prefers-reduced-motion: reduce`, never `none`. With `none`, `transitionend` never fires, and anything awaiting it — including this demo panel, and probably a test suite — deadlocks.',
			'The `reducedMotion` option can force the value either way regardless of the OS preference, and the override wins in both directions purely on CSS specificity, not source order.',
		],
	},
	{
		id: 'wheres-this-going',
		heading: "Where we're headed next",
		labelOverride: 'Roadmap',
		paragraphs: [
			"This heading is deliberately unhelpful as a nav label — good marketing copy is rarely a good four-word summary. `data-vane-label=\"Roadmap\"` on this section overrides the derived text with something that actually fits the pill, which is the honest escape hatch rather than a workaround.",
			'Next up: a shadcn registry item, a Vue port of the framework-free `core/` layer, and a proper `/scrollspy` docs route for anyone who only wants the label logic.',
		],
	},
	{
		id: 'api-surface',
		heading: 'The API surface',
		paragraphs: [
			'Two hooks — `useNavMorph` and `useSectionSpy` — and one compound component built on top of them. Three entry points: the default export (hooks + components + CSS), `/headless` (hooks and types only, zero CSS), and `/styles.css` for anyone who wants the stylesheet without the default import wiring it in automatically.',
			'This sidebar and the pill nav above are two independent consumers of the same hooks — the sidebar calls `useSectionSpy` directly from `/headless`, the nav gets its copy from `<Vane>` internally. Neither knows the other exists.',
		],
	},
];
