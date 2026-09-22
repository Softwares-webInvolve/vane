'use client';

// Real top-level import, not runtime injection: a navbar is the first thing
// above the fold, so injecting the stylesheet on mount would flash unstyled
// on every cold SSR load (unlike e.g. sonner, whose toaster renders nothing
// on first paint). `sideEffects` in package.json covers this import.
import './styles/vane.css';

export { Vane } from './components';
export type {
	VaneProps,
	VaneFullProps,
	VaneCompactProps,
	VaneLabelProps,
	VaneToggleProps,
	VanePanelProps,
	VaneProgressProps,
} from './components';

export { useNavMorph } from './react/use-nav-morph';
export type { UseNavMorphOptions, UseNavMorphResult, MorphState, Direction } from './react/use-nav-morph';

export { useSectionSpy } from './react/use-section-spy';
export type { UseSectionSpyOptions, UseSectionSpyResult } from './react/use-section-spy';

export { useNavHeight } from './react/use-nav-height';
export type { UseNavHeightOptions } from './react/use-nav-height';

export { useReducedMotion } from './react/use-reduced-motion';
export type { ReducedMotionMode } from './react/use-reduced-motion';

export { VaneContext, useVaneContext } from './react/context';
export type { VaneContextValue } from './react/context';

export type { Marker, SpyState } from './core/heading-index';
