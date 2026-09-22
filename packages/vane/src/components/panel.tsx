import { forwardRef, useEffect, useRef, type ComponentPropsWithoutRef, type KeyboardEvent } from 'react';
import { tabbables } from '../core/focus';
import { useMenuContext } from './menu-context';
import { mergeRefs } from './util';

export type VanePanelProps = ComponentPropsWithoutRef<'div'>;

/**
 * Sibling of `<nav>`, never a child — `backdrop-filter` on `[data-vane]`
 * makes it a containing block for `position: fixed` descendants, so a panel
 * nested inside it would position against the nav instead of the viewport.
 * `<Vane>` renders this as a sibling of `<nav>` inside `[data-vane-viewport]`
 * for exactly this reason (see `vane.tsx`).
 *
 * Owns three behaviours the plan calls out explicitly: Escape closes, focus
 * returns to the toggle on close, and focus is trapped inside while open.
 * "`inert` on the rest is not our job" (the plan's words) — that is a
 * decision for the page, not this component.
 */
export const VanePanel = forwardRef<HTMLDivElement, VanePanelProps>(function VanePanel(
	{ children, onKeyDown, ...rest },
	forwardedRef,
) {
	const menu = useMenuContext();
	const panelRef = useRef<HTMLDivElement | null>(null);

	// Move focus in on open; return it to the toggle on close. Effect (not
	// the click handler) so this also fires for state changes triggered any
	// other way (e.g. a consumer calling `setOpen` indirectly).
	useEffect(() => {
		if (menu.open) {
			const first = panelRef.current && tabbables(panelRef.current)[0];
			(first ?? panelRef.current)?.focus({ preventScroll: true });
		} else {
			menu.toggleRef.current?.focus({ preventScroll: true });
		}
	}, [menu.open, menu.toggleRef]);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;

		if (event.key === 'Escape') {
			event.stopPropagation();
			menu.setOpen(false);
			return;
		}

		if (event.key === 'Tab' && panelRef.current) {
			const focusable = tabbables(panelRef.current);
			if (focusable.length === 0) {
				event.preventDefault();
				return;
			}
			const first = focusable[0] as HTMLElement;
			const last = focusable[focusable.length - 1] as HTMLElement;
			const active = document.activeElement;

			if (event.shiftKey && active === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && active === last) {
				event.preventDefault();
				first.focus();
			}
		}
	};

	return (
		<div
			ref={mergeRefs(panelRef, forwardedRef)}
			id={menu.panelId}
			aria-labelledby={menu.toggleId}
			tabIndex={-1}
			data-vane-panel=""
			data-state={menu.open ? 'open' : 'closed'}
			onKeyDown={handleKeyDown}
			{...rest}
		>
			{children}
		</div>
	);
});
