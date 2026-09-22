import { SiteNav } from './site-nav';
import { Toc } from './toc';
import { LiveStatePanel } from './live-state-panel';
import { sections } from './sections';

export default function Home() {
	return (
		<>
			<SiteNav />

			<LiveStatePanel />

			<div className="page-shell">
				<main>
					{/* Intentionally short — the plan's whole point is that this page
					 * is scrollable within a second of landing, not a hero to admire. */}
					<div className="hero-lede">
						<h1>The nav that shows what you&apos;re reading</h1>
						<p>
							Scroll. Watch the pill above name the section you&apos;re in. Everything below is real
							content, not filler — keep going.
						</p>
					</div>

					{sections.map((section) => (
						<section key={section.id} className="demo-section">
							{/* The default selector is `h2[id], [data-vane-label]` — the id
							 * (what anchors target and what `getSectionLinkProps` matches
							 * against) has to live on the heading itself, not a wrapping
							 * element, or the heading index never picks it up. */}
							<h2
								id={section.id}
								{...(section.labelOverride ? { 'data-vane-label': section.labelOverride } : {})}
							>
								{section.heading}
							</h2>
							{section.paragraphs.map((paragraph, i) => (
								<p key={i}>{paragraph}</p>
							))}
						</section>
					))}
				</main>
				<Toc />
			</div>
		</>
	);
}
