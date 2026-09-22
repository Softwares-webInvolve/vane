/**
 * Focus correctness is the actual product — see the plan's positioning
 * section. Every decision below defends a specific, named failure mode; none
 * of the ordering here is arbitrary.
 */

const TABBABLE_SELECTOR = [
	'a[href]',
	'button',
	'input',
	'select',
	'textarea',
	'details',
	'audio[controls]',
	'video[controls]',
	'[contenteditable]:not([contenteditable="false"])',
	'[tabindex]',
].join(',');

/** A correct focusable query: excludes disabled, inert, and tabindex="-1". */
export function tabbables(root: Element): HTMLElement[] {
	const candidates = Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR));
	return candidates.filter((el) => {
		if (el.hasAttribute('disabled')) return false;
		if (el.hasAttribute('inert')) return false;
		if (el.closest('[inert]')) return false;
		const tabindex = el.getAttribute('tabindex');
		if (tabindex !== null && Number(tabindex) < 0) return false;
		return true;
	});
}

/**
 * Sets the IDL property, never the JSX attribute.
 *
 * React 18 renders `inert={true}` as the attribute `inert=""`, which is
 * truthy in HTML no matter what the JS value was. React 19 treats `inert` as
 * a real boolean attribute, so `inert={false}` there emits nothing — fine on
 * its own, but a package that has to work on both majors cannot express this
 * from JSX at all. Setting `el.inert` directly sidesteps both.
 *
 * `data-hidden` is mirrored for styling — CSS has no `:inert` fallback story
 * as portable as an attribute selector.
 */
export function applyInert(el: HTMLElement, on: boolean): void {
	el.inert = on;
	if (on) el.setAttribute('data-hidden', '');
	else el.removeAttribute('data-hidden');
}

export interface HandoffOptions {
	from: HTMLElement;
	to: HTMLElement;
	navEl: HTMLElement;
}

/**
 * Set synchronously around every programmatic `.focus()` call this module
 * makes, so a `focusin` listener elsewhere (the hidden→compact promotion in
 * `use-nav-morph.ts`) can distinguish "we just moved focus" from "the user
 * just tabbed". `focus()` dispatches `focusin` synchronously, so resetting
 * this via `setTimeout` would run one tick too late — the listener would
 * already have seen the flag as `false` for our own dispatch.
 */
export const programmaticFocus = { current: false };

function resolveTarget(to: HTMLElement, navEl: HTMLElement): HTMLElement {
	const anchor = to.querySelector<HTMLElement>('[data-vane-focus-anchor]');
	if (anchor) return anchor;
	const first = tabbables(to)[0];
	if (first) return first;
	return navEl;
}

/**
 * Move focus from one region to the other and update `inert` accordingly.
 *
 * Order: `to` is made focusable, focus is moved into it, and only THEN is
 * `from` marked inert. Setting `inert` on `from` before focus has left it
 * forces the browser to resolve a new focus target from a subtree that is
 * already inert, which lands on `<body>` with no way back for a keyboard
 * user. `preventScroll` matters too: without it, focusing the target scrolls
 * it into view, which feeds the scroll machine, which re-evaluates state —
 * a genuine feedback loop, not a cosmetic one.
 */
export function handoff({ from, to, navEl }: HandoffOptions): void {
	applyInert(to, false);

	const target = resolveTarget(to, navEl);

	programmaticFocus.current = true;
	target.focus({ preventScroll: true });
	programmaticFocus.current = false;

	applyInert(from, true);
}

/** `:focus-visible` is only reliable inside try/catch — unsupported engines throw. */
export function isKeyboardFocus(target: Element | null): boolean {
	if (!target) return false;
	try {
		return target.matches(':focus-visible');
	} catch {
		return false;
	}
}
