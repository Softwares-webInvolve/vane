import { Vane as VaneRoot, type VaneProps } from './vane';
import { VaneFull, type VaneFullProps } from './full';
import { VaneCompact, type VaneCompactProps } from './compact';
import { VaneLabel, type VaneLabelProps } from './label';
import { VaneToggle, type VaneToggleProps } from './toggle';
import { VanePanel, type VanePanelProps } from './panel';
import { VaneProgress, type VaneProgressProps } from './progress';

/**
 * `Vane.Full`/`Vane.Compact`/etc are attached as static properties rather
 * than exported standalone — the compound-component call shape from the
 * plan (`<Vane><Vane.Full/>...</Vane>`) is the only supported API surface,
 * so there is exactly one way to discover the parts.
 */
export const Vane = Object.assign(VaneRoot, {
	Full: VaneFull,
	Compact: VaneCompact,
	Label: VaneLabel,
	Toggle: VaneToggle,
	Panel: VanePanel,
	Progress: VaneProgress,
});

export type {
	VaneProps,
	VaneFullProps,
	VaneCompactProps,
	VaneLabelProps,
	VaneToggleProps,
	VanePanelProps,
	VaneProgressProps,
};
