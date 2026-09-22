'use client';

import { useSectionSpy } from '@webinvolve/vane/headless';

/**
 * A second, independent `useSectionSpy()` call — deliberately not sharing
 * the nav's instance. Demonstrates that the hook is genuinely reusable
 * standalone (the whole point of the `/headless` entry point: zero CSS,
 * usable for a plain sidebar TOC like this one) rather than something only
 * `<Vane>` itself can drive.
 */
export function Toc() {
	const spy = useSectionSpy();

	return (
		<nav className="toc" aria-label="Table of contents">
			<h2>On this page</h2>
			<ol>
				{spy.sections.map((section) => (
					<li key={section.id ?? section.index}>
						<a href={section.id ? `#${section.id}` : undefined} {...spy.getSectionLinkProps(section.id ?? '')}>
							{section.label}
						</a>
					</li>
				))}
			</ol>
		</nav>
	);
}
