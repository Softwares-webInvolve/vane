'use client';

import { Vane } from '@webinvolve/vane';
import { NavLink } from './nav-link';
import { sections } from './sections';

// Decorative only — the toggle's accessible name comes from the required
// `aria-label` prop, not from this icon, so it stays correct even if the
// SVG is ever swapped out.
function MenuIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}

/**
 * The whole `<Vane>` tree lives in one client component, not inline in the
 * (server) page. `Vane.Full`/`Vane.Toggle`/etc are properties attached to
 * the `Vane` function at runtime (`Object.assign` in components/index.ts),
 * not separate named module exports — React Server Components can only
 * turn statically-analyzable named/default exports of a `"use client"`
 * module into client references, so `Vane.Full` resolves to `undefined`
 * when accessed from a Server Component. Keeping the whole compound tree
 * inside one client module sidesteps that entirely: the property access
 * happens in real, already-client JS, not through an RSC reference proxy.
 */
export function SiteNav() {
	return (
		<Vane label="Primary" offset={64} threshold={16} collapseTo="compact">
			<Vane.Full>
				<a id="top" href="#top" className="wordmark">
					Vane
				</a>
				<NavLink href="#quick-start">Quick start</NavLink>
				<NavLink href="#focus-correctness">Focus</NavLink>
				<NavLink href="#css-js-split">CSS/JS split</NavLink>
				<NavLink href="#api-surface">API</NavLink>
				<a className="nav-link" href="https://github.com/Softwares-webInvolve/vane">
					GitHub
				</a>
			</Vane.Full>
			<Vane.Compact>
				<Vane.Label />
				<Vane.Progress />
				<Vane.Toggle aria-label="Open menu">
					<MenuIcon />
				</Vane.Toggle>
			</Vane.Compact>
			<Vane.Panel>
				<div className="panel-links">
					{sections.map((section) => (
						<NavLink key={section.id} href={`#${section.id}`}>
							{section.labelOverride ?? section.heading}
						</NavLink>
					))}
					<a className="nav-link" href="https://github.com/Softwares-webInvolve/vane">
						GitHub
					</a>
				</div>
			</Vane.Panel>
		</Vane>
	);
}
