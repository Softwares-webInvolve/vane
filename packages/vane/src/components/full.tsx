import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useVaneContext } from '../react/context';
import { mergeRefs } from './util';

export type VaneFullProps = ComponentPropsWithoutRef<'div'>;

/**
 * The expanded region — spreads `morph.fullProps`, which is what carries
 * `data-vane-region="full"` and the ref the height/width `ResizeObserver`
 * measures. Inert-ness while collapsed is applied imperatively by the hook
 * (`focus.applyInert`), never through JSX — see `core/focus.ts`.
 */
export const VaneFull = forwardRef<HTMLElement, VaneFullProps>(function VaneFull(
	{ children, ...rest },
	forwardedRef,
) {
	const { morph } = useVaneContext();
	const { ref, ...fullProps } = morph.fullProps;
	return (
		<div ref={mergeRefs(ref, forwardedRef)} {...fullProps} {...rest}>
			{children}
		</div>
	);
});
