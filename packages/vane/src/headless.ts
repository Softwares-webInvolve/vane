'use client';

// Hooks and types ONLY — deliberately no `./styles/vane.css` import. A
// separate specifier is the only way to *prove* at the bundler level that
// these hooks work with zero CSS, for consumers building their own visual
// layer entirely.

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
