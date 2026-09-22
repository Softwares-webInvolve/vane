# Prototype gate 1 — result: the CSS-only width morph does not exist

Measured 2026-09-21, Playwright 1.62, real WebKit 26 and Firefox 155.
Harness: `grid-morph.html` + `run.mjs`. Re-runnable.

| technique | Chromium | WebKit | Firefox |
|---|---|---|---|
| A — `grid-template-columns: 1fr→0fr`, `width: fit-content` | SNAP | SNAP | SNAP |
| B — same + `max-width: 100%` | SNAP (3 steps) | SNAP | SNAP |
| C — **measured width via custom property** | **TWEEN** (23 inter.) | **TWEEN** (23) | **TWEEN** (24) |
| D — `interpolate-size: allow-keywords` | TWEEN | SNAP | SNAP |

## What this means

A and B fail worse than "degrades badly": inside a `fit-content` container the
width does not change **at all**, in any engine. `fr` tracks resolve against
available space, and a shrink-to-fit container has no definite available space,
so the tracks never redistribute. This is not a browser bug — it is what `fr`
means. The design's preferred technique was wrong.

D confirms the research: `interpolate-size` is Chromium-only (Chrome 129+), and
in WebKit/Firefox `width: auto → auto` is not interpolable so the element snaps.
Correctly rejected as a dependency.

## Decision

**Ship C.** Measure both layouts, publish them as lengths, let CSS `transition`
animate between them.

This is not "JS animates the nav" — the transition is still CSS, we only supply
the endpoints. The measurement rides the `ResizeObserver` already required for
`--vane-height`, so the marginal cost is one extra read, not new machinery.

It is also the *better* outcome for the positioning: C behaves identically in all
three engines, where a CSS-only technique would have given us a two-tier product
that looks broken in two of them.

## Unaffected by this result

- `animation-timeline: scroll()` — supported in Chromium and WebKit, **not
  Firefox** (confirmed here). Still used for the elevation ramp and the progress
  hairline, with the `@supports not` binary fallback for Firefox.
- `offset-path: ellipse()` — supported in all three (confirmed here).
