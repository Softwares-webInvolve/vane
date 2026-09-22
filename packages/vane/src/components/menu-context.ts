import { createContext, useContext, type RefObject } from 'react';

/**
 * Shared open/closed state between `Vane.Toggle` and `Vane.Panel`.
 *
 * Kept separate from `VaneContext` (react/context.ts) because that context
 * is part of the hook layer's public shape (`useVaneContext`) and describes
 * morph/spy results, not disclosure-widget wiring that only the compound
 * components need.
 */
export interface MenuContextValue {
	open: boolean;
	setOpen: (open: boolean) => void;
	toggleId: string;
	panelId: string;
	toggleRef: RefObject<HTMLButtonElement | null>;
}

export const MenuContext = createContext<MenuContextValue | null>(null);

/** `<Vane>` always provides this (it owns the open/closed state), so a
 * `null` read only happens when `Vane.Toggle`/`Vane.Panel` are rendered
 * outside `<Vane>` — the same misuse `useVaneContext` guards against. */
export function useMenuContext(): MenuContextValue {
	const ctx = useContext(MenuContext);
	if (!ctx) {
		throw new Error('[vane] Vane.Toggle / Vane.Panel must be rendered inside <Vane>.');
	}
	return ctx;
}
