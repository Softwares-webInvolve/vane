#!/usr/bin/env node
// The `data-vane*` attribute contract is public and semver-covered:
// consumers style and query against these attributes directly, so emitting
// one that isn't documented is a breaking change waiting to happen.
//
// This script greps the built `dist` for every `data-vane*` literal and
// diffs it against the allowlist below. It is intentionally simple: a
// regex over dist plus a Set difference.
//
// The allowlist reflects the attributes implemented in src/ as of writing
// (data-vane, data-vane-label, data-vane-ignore, data-vane-focus-anchor,
// data-vane-region — see src/core/observers.ts, src/core/focus.ts,
// src/core/heading-index.ts, src/react/use-nav-morph.ts) plus every
// data-vane* literal named in the plan. Note: `data-state` and
// `data-scrolled` are intentionally out of scope — they are not
// `vane`-namespaced and this contract only covers `data-vane*`.
//
// Extend this list deliberately, in the same commit that introduces a new
// attribute in src/ — that is the point of the check.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ALLOWED_ATTRIBUTES = new Set([
	'data-vane',
	'data-vane-label',
	'data-vane-ignore',
	'data-vane-focus-anchor',
	'data-vane-region',
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '../packages/vane/dist');

function walk(dir, files = []) {
	for (const entry of readdirSync(dir)) {
		const abs = path.join(dir, entry);
		if (statSync(abs).isDirectory()) {
			walk(abs, files);
		} else if (/\.(js|mjs|cjs|css)$/.test(entry)) {
			files.push(abs);
		}
	}
	return files;
}

let files;
try {
	statSync(distDir);
	files = walk(distDir);
} catch {
	console.error(
		`check-data-contract: ${distDir} not found — build the package first (pnpm --filter @webinvolve/vane build).`,
	);
	process.exit(1);
}

if (files.length === 0) {
	console.error(`check-data-contract: no built files found under ${distDir} — build the package first.`);
	process.exit(1);
}

const ATTR_RE = /data-vane[a-z0-9-]*/gi;
const found = new Set();

for (const file of files) {
	const contents = readFileSync(file, 'utf8');
	for (const match of contents.matchAll(ATTR_RE)) {
		found.add(match[0].toLowerCase());
	}
}

const undocumented = [...found].filter((attr) => !ALLOWED_ATTRIBUTES.has(attr));

if (undocumented.length > 0) {
	console.error('check-data-contract: emitted data-vane* attribute(s) not in the allowlist:');
	for (const attr of undocumented) {
		console.error(`  ${attr}`);
	}
	console.error(
		'If this is intentional, add it to ALLOWED_ATTRIBUTES in scripts/check-data-contract.mjs deliberately — it is a semver-covered contract change.',
	);
	process.exit(1);
}

console.log(`check-data-contract: ok (${found.size} known attribute(s) found across ${files.length} file(s)).`);
