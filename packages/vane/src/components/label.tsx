import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useVaneContext } from '../react/context';
import type { Marker } from '../core/heading-index';

export interface VaneLabelProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
	/** Render-prop escape hatch — receives the resolved label text and the
	 * full active marker (id, index) for consumers who want more than text. */
	children?: (label: string, section: Marker | null) => ReactNode;
}

/**
 * The self-locating label. `aria-hidden` (via `spy.labelProps`) is
 * deliberate, not an oversight — on mobile the capsule IS the toggle button,
 * and a button whose accessible name changes on every scroll tick is worse
 * than a live region. The real semantics live on `aria-current="location"`
 * via `getSectionLinkProps`, wired up on the consumer's own in-page links.
 */
export function VaneLabel({ children, ...rest }: VaneLabelProps) {
	const { spy } = useVaneContext();
	return (
		<span {...spy.labelProps} data-vane-label="" data-section-id={spy.active?.id} {...rest}>
			{children ? children(spy.label, spy.active) : spy.label}
		</span>
	);
}
