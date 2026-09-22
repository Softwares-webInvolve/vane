import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { useVaneContext } from '../react/context';
import { mergeRefs } from './util';

export type VaneCompactProps = ComponentPropsWithoutRef<'div'>;

/** The collapsed region — mirrors `VaneFull`, spreading `morph.compactProps`. */
export const VaneCompact = forwardRef<HTMLElement, VaneCompactProps>(function VaneCompact(
	{ children, ...rest },
	forwardedRef,
) {
	const { morph } = useVaneContext();
	const { ref, ...compactProps } = morph.compactProps;
	return (
		<div ref={mergeRefs(ref, forwardedRef)} {...compactProps} {...rest}>
			{children}
		</div>
	);
});
