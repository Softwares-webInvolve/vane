import {
	useId,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
	type RefObject,
} from 'react';
import { useNavMorph, type UseNavMorphOptions } from '../react/use-nav-morph';
import { useSectionSpy, type UseSectionSpyOptions } from '../react/use-section-spy';
import { VaneContext, type VaneContextValue } from '../react/context';
import { MenuContext, type MenuContextValue } from './menu-context';
import { VanePanel } from './panel';
import { VaneToggle } from './toggle';
import { containsType, partitionByType, pick } from './util';

const MORPH_KEYS = [
	'offset',
	'threshold',
	'collapseTo',
	'disabled',
	'root',
	'reducedMotion',
	'focusDeferDistance',
	'heightVar',
] as const satisfies readonly (keyof UseNavMorphOptions)[];

const SPY_KEYS = [
	'selector',
	'scope',
	'getLabel',
	'readingLine',
	'band',
	'sticky',
	'fallback',
	'watchMutations',
	'onChange',
] as const satisfies readonly (keyof UseSectionSpyOptions)[];

export interface VaneProps extends UseNavMorphOptions, UseSectionSpyOptions {
	/** Accessible name for the `<nav>` landmark (`aria-label`). */
	label: string;
	children: ReactNode;
	className?: string;
	style?: CSSProperties;
}

/**
 * The compound component root. Owns the two hooks, the shared open/closed
 * menu state (`Vane.Toggle` <-> `Vane.Panel`), and the DOM shape the plan is
 * explicit about:
 *
 *   [data-vane-viewport]      fixed, pointer-events: none
 *     <nav data-vane>         pointer-events: auto
 *       ...Full/Compact...
 *     [data-vane-panel]       SIBLING of <nav>, not a child (see panel.tsx)
 *
 * No portal, no `react-dom` — both live inside the same fixed wrapper, which
 * is also what keeps `Vane.Panel` positioned against the viewport instead of
 * the (backdrop-filtered) nav.
 */
export function Vane({ label, children, className, style, ...rest }: VaneProps) {
	const morphOptions = pick(rest, MORPH_KEYS);
	const spyOptions = pick(rest, SPY_KEYS);

	const morph = useNavMorph(morphOptions);
	const spy = useSectionSpy(spyOptions);

	const [menuOpen, setMenuOpen] = useState(false);
	const toggleId = useId();
	const panelId = useId();
	const toggleRef = useRef<HTMLButtonElement | null>(null);

	const vaneContextValue = useMemo<VaneContextValue>(
		() => ({ morph, spy, options: { morph: morphOptions, spy: spyOptions } }),
		// morphOptions/spyOptions are fresh objects every render (built from
		// `pick`), so keying off the hook results themselves is what actually
		// keeps this memo meaningful.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[morph, spy],
	);

	const menuContextValue = useMemo<MenuContextValue>(
		() => ({ open: menuOpen, setOpen: setMenuOpen, toggleId, panelId, toggleRef }),
		[menuOpen, toggleId, panelId],
	);

	// `data-menu` is reserved for "a Toggle exists" — a `<Vane>` with no
	// disclosure widget (e.g. compact links always visible) should not carry
	// menu-open/closed state it has no button for.
	const hasToggle = useMemo(() => containsType(children, VaneToggle), [children]);
	const { matches: panels, rest: navChildren } = partitionByType(children, VanePanel);

	const { ref: viewportRef, ...viewportRest } = morph.viewportProps;
	const { ref: navRef, ...navRest } = morph.navProps;

	// `data-reduced-motion` is emitted ONLY when the option overrides the OS
	// preference — see vane.css for why the attribute has to win over
	// `prefers-reduced-motion` in both directions via specificity, not order.
	const reducedMotionMode = morphOptions.reducedMotion ?? 'user';

	return (
		<VaneContext.Provider value={vaneContextValue}>
			<MenuContext.Provider value={menuContextValue}>
				<div
					// The hook types this generically as `RefObject<HTMLElement | null>`
					// (it doesn't know which tag it'll be attached to); this is
					// always a `<div>` here.
					ref={viewportRef as RefObject<HTMLDivElement | null>}
					data-vane-viewport=""
					{...viewportRest}
					className={className}
					style={style}
				>
					<nav
						ref={navRef}
						{...navRest}
						aria-label={label}
						data-direction={morph.direction}
						{...(reducedMotionMode !== 'user'
							? { 'data-reduced-motion': String(morph.reducedMotion) }
							: {})}
						{...(hasToggle ? { 'data-menu': menuOpen ? 'open' : 'closed' } : {})}
					>
						{navChildren}
					</nav>
					{panels}
				</div>
			</MenuContext.Provider>
		</VaneContext.Provider>
	);
}
