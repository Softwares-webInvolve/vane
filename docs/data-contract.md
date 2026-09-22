# The `data-*` contract

This is the authoritative, semver-covered contract for every `data-*`
attribute `@webinvolve/vane` reads or writes. Consumers style and query
against these directly, so it is a breaking change to rename, remove, or
change the meaning of any row here without a major version bump.

Only the `data-vane*`-namespaced rows are enforced mechanically by
`scripts/check-data-contract.mjs` (it greps the built `dist` for every
`data-vane*` literal and diffs it against an allowlist). Non-namespaced
attributes (`data-state`, `data-scrolled`, `data-direction`,
`data-reduced-motion`, `data-menu`, `data-hidden`, `data-active`,
`data-section-id`) are just as covered by this document, but are out of
scope for that script because the regex only matches `data-vane*`.

| Element | Attribute | Values |
|---|---|---|
| `[data-vane-viewport]` | — | the fixed wrapper. `<Vane>`'s outermost element. |
| `[data-vane]` (the `<nav>`) | `data-state` | `full` \| `compact` \| `hidden` |
| | `data-direction` | `up` \| `down` \| `none` |
| | `data-scrolled` | present when scroll position > `offset` (Firefox elevation-ramp fallback; scroll-driven `animation-timeline` covers this in Chromium/WebKit) |
| | `data-reduced-motion` | `true` \| `false` — emitted ONLY when `reducedMotion` is `'always'` or `'never'` (never emitted for the default `'user'`, since then the OS media query alone decides) |
| | `data-menu` | `open` \| `closed` — emitted ONLY when a `Vane.Toggle` is present in the tree |
| `[data-vane-region]` | value | `full` \| `compact` — which of `Vane.Full`/`Vane.Compact` this is |
| | `data-hidden` | present ⟺ the region's `inert` IDL property is `true` (applied imperatively via ref in `core/focus.ts`, never through JSX — see that file for why) |
| `[data-vane-label]` (the rendered `Vane.Label`) | `data-section-id` | the current active section's `id`, or absent if none resolved yet |
| `[data-vane-toggle]` (`Vane.Toggle`) | `data-state` | `open` \| `closed` |
| `[data-vane-panel]` (`Vane.Panel`) | `data-state` | `open` \| `closed` |
| in-page link (consumer-authored) | `aria-current` | `location` — set via `spy.getSectionLinkProps(id)`, spread onto the consumer's own `<a>`/`next/link` |
| | `data-active` | present as an alternative styling hook for consumers who prefer `data-*` over `aria-current` for CSS (see the last rule in `vane.css`) |

## Inputs — attributes consumers set on their own markup

| Attribute | Meaning |
|---|---|
| `data-vane-label="Custom text"` | Overrides the auto-derived label for that heading/section. An empty `data-vane-label=""` falls through to the element's own text rather than producing a blank label (see `core/heading-index.ts`'s `defaultGetLabel`). |
| `data-vane-ignore` | Excludes the subtree from section scanning (`core/observers.ts`'s `isIgnored`). |
| `data-vane-focus-anchor` | Marks the element that should receive focus first on a full<->compact handoff, overriding the "first tabbable" default (`core/focus.ts`'s `resolveTarget`). |

Note that `data-vane-label` appears twice in this document — once as an
*input* (a value consumers set on their own `h2`/section elements) and once
as a *marker* on the component-rendered `<Vane.Label>` span. These are two
different elements; the name is shared because both describe "the label",
not because they are the same attribute occurrence.

## Published custom properties

| Property | Meaning |
|---|---|
| `--vane-height` | The nav's live border-box height, written to `documentElement` (and mirrored on the nav itself). Renameable via the `heightVar` option. Recipe: `html { scroll-padding-top: calc(var(--vane-height, 4rem) + 1rem); }` (WCAG 2.2 SC 2.4.11). |
| `--vane-height-max` | The highest height ever observed — for consumers who want a no-overlap guarantee without reacting to every transition. |
| `--vane-w` / `--vane-h` | The active region's measured width/height, written to `[data-vane-viewport]`. This is the GATE1 outcome (see `proto/GATE1.md`): the full<->compact width morph transitions between these two measured lengths instead of a CSS-only `1fr -> 0fr` trick, which does not animate in any engine inside a `fit-content` container. |

## Theme tokens

Documented and defaulted in `src/styles/vane.css`: `--vane-bg`,
`--vane-blur`, `--vane-border`, `--vane-fg`, `--vane-accent`,
`--vane-radius`, `--vane-radius-compact`, `--vane-shadow`,
`--vane-duration`, `--vane-ease`, `--vane-pad-x`, `--vane-pad-y`,
`--vane-gap`, `--vane-max-width`, `--vane-z`.

## `aria-current` and multiple navigation sets

MDN's rule is that only one element **in a set** may be current. A page with
both a pill nav and a table-of-contents sidebar has two independent sets, and
each correctly marks its own current item — so a document-wide
`querySelectorAll('[aria-current="location"]')` legitimately returns more than
one on such a page. The demo does exactly this.

Tests must therefore assert **one per navigation landmark**, not one per
document. An earlier draft of the plan said "exactly one at any moment"; that
was too strict and would have failed a correct page.
