#!/usr/bin/env node
// A dependency-free CSS minifier for the one stylesheet this package ships.
// Not a general-purpose minifier — good enough for hand-authored CSS with no
// `url()`/string literals containing `/*`, `{`, `}`, or `;`, which is true
// of src/styles/vane.css. Exists because the 4.0kB gzip budget (plan §API
// surface) is for the *shipped* CSS, and the source is comment-heavy on
// purpose for maintainers.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(pkgDir, 'src/styles/vane.css'), 'utf8');

const minified = src
	.replace(/\/\*[\s\S]*?\*\//g, '') // block comments
	.replace(/\s+/g, ' ') // collapse whitespace/newlines
	.replace(/\s*([{}:;,])\s*/g, '$1') // trim around punctuation
	.replace(/;}/g, '}') // drop trailing semicolon before a close brace
	.trim();

// Written to two places:
// - dist/styles/vane.css: `src/index.ts`'s `import "./styles/vane.css"` is
//   built with `--external ./styles/vane.css` (see package.json's `build`
//   script) so bunchee leaves the specifier untouched in dist/index.mjs|cjs
//   instead of inlining the CSS as a runtime `<style>` injector — its only
//   built-in CSS mode. A real top-level import matters because a navbar is
//   above the fold: injection means the SSR'd HTML flashes unstyled on cold
//   load. The relative specifier only resolves if a real file sits at this
//   path alongside dist/index.*.
// - dist/styles.css: the `./styles.css` subpath in package.json's `exports`,
//   for consumers who want to import the stylesheet explicitly (e.g. from a
//   framework CSS pipeline instead of relying on the JS import).
mkdirSync(path.join(pkgDir, 'dist/styles'), { recursive: true });
writeFileSync(path.join(pkgDir, 'dist/styles/vane.css'), minified);
writeFileSync(path.join(pkgDir, 'dist/styles.css'), minified);
console.log(
	`build-css: wrote dist/styles/vane.css and dist/styles.css (${minified.length} bytes, source was ${src.length}).`,
);
