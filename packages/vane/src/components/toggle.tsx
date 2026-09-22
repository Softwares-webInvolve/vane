import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useMenuContext } from './menu-context';
import { mergeRefs } from './util';

/**
 * `aria-label` is REQUIRED, not optional — a compile error is the most
 * effective a11y enforcement available, and it structurally prevents the
 * "mobile menu cannot be opened by keyboard" failure (Aceternity's
 * `<svg onClick>` toggle has no accessible name and isn't a `<button>` at
 * all). `type="button"` is fixed because this never submits a form.
 */
export interface VaneToggleProps extends Omit<ComponentPropsWithoutRef<'button'>, 'type'> {
	'aria-label': string;
}

/**
 * Always a real `<button>` with `aria-expanded` + `aria-controls`. CSS
 * `display` decides visibility (see `[data-vane-toggle]` in vane.css) —
 * never a JS breakpoint — so `display: none` correctly removes it from the
 * tab order on desktop instead of leaving an invisible-but-focusable button.
 */
export const VaneToggle = forwardRef<HTMLButtonElement, VaneToggleProps>(function VaneToggle(
	{ children, onClick, ...rest },
	forwardedRef,
) {
	const menu = useMenuContext();

	return (
		<button
			ref={mergeRefs(menu.toggleRef, forwardedRef)}
			type="button"
			id={menu.toggleId}
			aria-expanded={menu.open}
			aria-controls={menu.panelId}
			data-vane-toggle=""
			data-state={menu.open ? 'open' : 'closed'}
			onClick={(event) => {
				onClick?.(event);
				if (!event.defaultPrevented) menu.setOpen(!menu.open);
			}}
			{...rest}
		>
			{children}
		</button>
	);
});
