#!/usr/bin/env node
// Verifies every JS entry point declared in packages/vane/package.json's
// `exports` map starts with the "use client" directive on line 1.
//
// bunchee preserves the directive from source (src/index.ts,
// src/headless.ts), but a refactor can silently drop it — the failure then
// only surfaces as a confusing error inside a consumer's Server Component.
// This check catches it at build time instead.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(scriptDir, '../packages/vane');
const pkgPath = path.join(pkgDir, 'package.json');

let pkg;
try {
	pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (err) {
	console.error(`check-use-client: could not read ${pkgPath}: ${err.message}`);
	process.exit(1);
}

/** Recursively collect every string leaf in an exports map. */
function collectPaths(node, out) {
	if (typeof node === 'string') {
		out.add(node);
		return;
	}
	if (node && typeof node === 'object') {
		for (const [condition, value] of Object.entries(node)) {
			if (condition === 'types') continue; // .d.ts files carry no directive
			collectPaths(value, out);
		}
	}
}

const allPaths = new Set();
collectPaths(pkg.exports, allPaths);

const jsFiles = [...allPaths].filter((p) => /\.(js|mjs|cjs)$/.test(p));

if (jsFiles.length === 0) {
	console.error('check-use-client: no JS entry points found in package.json "exports".');
	process.exit(1);
}

const DIRECTIVE_RE = /^(['"])use client\1;?$/;
const missing = [];
const unreadable = [];

for (const rel of jsFiles) {
	const abs = path.resolve(pkgDir, rel);
	let contents;
	try {
		contents = readFileSync(abs, 'utf8');
	} catch (err) {
		unreadable.push({ rel, message: err.message });
		continue;
	}
	const firstLine = contents.split('\n')[0].trim();
	if (!DIRECTIVE_RE.test(firstLine)) {
		missing.push(rel);
	}
}

if (unreadable.length > 0) {
	console.error(
		'check-use-client: dist file(s) not found — build the package first (pnpm --filter @webinvolve/vane build):',
	);
	for (const { rel, message } of unreadable) {
		console.error(`  ${rel}: ${message}`);
	}
	process.exit(1);
}

if (missing.length > 0) {
	console.error('check-use-client: missing "use client" directive on line 1:');
	for (const rel of missing) {
		console.error(`  ${rel}`);
	}
	process.exit(1);
}

console.log(`check-use-client: ok (${jsFiles.length} file(s) checked).`);
