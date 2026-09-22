import { Children, isValidElement, type ReactElement, type ReactNode, type Ref } from 'react';

/**
 * A prop bag's `ref` key is `RefObject<T | null>` (the hooks' convention);
 * component authors also need to accept a caller-supplied `ref` via
 * `forwardRef`. Assigning both without a third dependency (no `react-dom`
 * peer, per the plan) means merging them by hand.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined | null>): (node: T | null) => void {
	return (node) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === 'function') ref(node);
			else (ref as { current: T | null }).current = node;
		}
	};
}

/** Shallow `pick` typed against a fixed key list — used to split the merged
 * `<Vane>` props back into `UseNavMorphOptions` / `UseSectionSpyOptions`. */
export function pick<T extends object, K extends readonly (keyof T)[]>(
	obj: T,
	keys: K,
): Pick<T, K[number]> {
	const out = {} as Pick<T, K[number]>;
	for (const key of keys) {
		if (key in obj) out[key] = obj[key];
	}
	return out;
}

/**
 * Recursively checks whether `children` contains an element of `type`.
 *
 * Used only to decide whether `<nav data-menu>` should be emitted at all
 * (the contract reserves it for "only when a Toggle exists") — a render-time
 * tree walk, not a perf-sensitive path, so a straightforward recursion over
 * `props.children` is fine.
 */
export function containsType(children: ReactNode, type: unknown): boolean {
	let found = false;
	Children.forEach(children, (child) => {
		if (found || !isValidElement(child)) return;
		const el = child as ReactElement<{ children?: ReactNode }>;
		if (el.type === type) {
			found = true;
			return;
		}
		if (el.props && 'children' in el.props) {
			found = containsType(el.props.children, type);
		}
	});
	return found;
}

/** Splits top-level children into `Vane.Panel` elements and everything else. */
export function partitionByType(
	children: ReactNode,
	type: unknown,
): { matches: ReactElement[]; rest: ReactNode[] } {
	const matches: ReactElement[] = [];
	const rest: ReactNode[] = [];
	Children.forEach(children, (child) => {
		if (isValidElement(child) && child.type === type) matches.push(child);
		else if (child !== undefined && child !== null && child !== false) rest.push(child);
	});
	return { matches, rest };
}
