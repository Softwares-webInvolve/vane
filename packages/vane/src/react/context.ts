import { createContext, useContext } from 'react';
import type { UseNavMorphOptions, UseNavMorphResult } from './use-nav-morph';
import type { UseSectionSpyOptions, UseSectionSpyResult } from './use-section-spy';

/**
 * What the compound components (`Vane.Full`, `Vane.Compact`, `Vane.Label`,
 * `Vane.Toggle`, `Vane.Panel` — written by whoever consumes this) need from
 * `<Vane>`: the two hook results, plus the resolved options that produced
 * them (so, e.g., `Vane.Toggle` can read `collapseTo` without re-deriving it).
 */
export interface VaneContextValue {
	morph: UseNavMorphResult;
	spy: UseSectionSpyResult;
	options: {
		morph: UseNavMorphOptions;
		spy: UseSectionSpyOptions;
	};
}

export const VaneContext = createContext<VaneContextValue | null>(null);

export function useVaneContext(): VaneContextValue {
	const ctx = useContext(VaneContext);
	if (!ctx) {
		throw new Error('[vane] Vane.* compound components must be rendered inside <Vane>.');
	}
	return ctx;
}
