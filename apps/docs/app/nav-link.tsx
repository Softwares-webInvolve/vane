'use client';

import type { AnchorHTMLAttributes } from 'react';
import { useVaneContext } from '@webinvolve/vane';

/**
 * The router-agnostic contract in practice: `@webinvolve/vane` renders no
 * `<a>` itself, so wiring `aria-current="location"` onto ours is on us —
 * `spy.getSectionLinkProps` is exactly the escape hatch for that. Only
 * usable inside `<Vane>` (reads `useVaneContext`), which both `Vane.Full`
 * and `Vane.Panel` are.
 */
export function NavLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
	const { spy } = useVaneContext();
	const id = href?.startsWith('#') ? href.slice(1) : undefined;
	const linkProps = id ? spy.getSectionLinkProps(id) : {};

	return (
		<a href={href} className="nav-link" {...linkProps} {...rest}>
			{children}
		</a>
	);
}
