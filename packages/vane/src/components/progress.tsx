import type { ComponentPropsWithoutRef } from 'react';

export type VaneProgressProps = ComponentPropsWithoutRef<'div'>;

/**
 * Pure-CSS reading-progress hairline — no JS, no data-vane* attribute (it
 * isn't part of the authoritative data-* contract; see docs/data-contract.md),
 * styled entirely off the `.vane-progress` class in vane.css via
 * `animation-timeline: scroll(root)`, guarded by `@supports` for Firefox
 * (which drops the class to `display: none` rather than reimplementing it in
 * JS — the plan requires this component stay JS-free).
 */
export function VaneProgress({ className, ...rest }: VaneProgressProps) {
	return (
		<div
			aria-hidden="true"
			className={className ? `vane-progress ${className}` : 'vane-progress'}
			{...rest}
		/>
	);
}
