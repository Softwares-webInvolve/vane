#!/usr/bin/env node
// Smoke test: pnpm pack -> install the tarball into a throwaway Next.js
// app -> build it -> assert the emitted CSS contains `[data-vane]`.
//
// Per the plan, this is the ONLY gate that catches a bad `sideEffects`
// value in packages/vane/package.json (`publint` will not): if
// `sideEffects` were `false` instead of `["*.css"]`, a production bundler
// would tree-shake the CSS import away and this assertion would fail.
//
// Runnable standalone: `node apps/smoke/run.mjs`
// Requires network access (installs next/react/react-dom + the packed
// tarball into a scratch directory). If the network is unavailable, this
// exits 0 with a clear "skipped" message rather than failing CI.
import { execFileSync } from 'node:child_process';
import {
	mkdtempSync,
	existsSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	rmSync,
	statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const pkgDir = path.join(repoRoot, 'packages/vane');

const NETWORK_ERROR_PATTERNS = [
	'ENOTFOUND',
	'ETIMEDOUT',
	'ECONNREFUSED',
	'ECONNRESET',
	'EAI_AGAIN',
	'network',
];

function isNetworkError(message) {
	return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function run(cmd, args, options = {}) {
	return execFileSync(cmd, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		...options,
	});
}

function fail(message) {
	console.error(`apps/smoke: ${message}`);
	process.exit(1);
}

function skip(message) {
	console.log(`apps/smoke: skipped — ${message}`);
	process.exit(0);
}

async function main() {
	// 1. The package must already be built (`files: ["dist"]` means an
	// unbuilt package packs an empty, useless tarball).
	if (!existsSync(path.join(pkgDir, 'dist'))) {
		fail(
			'packages/vane/dist not found — build the package first (pnpm --filter @webinvolve/vane build).',
		);
	}

	const workDir = mkdtempSync(path.join(tmpdir(), 'vane-smoke-'));
	console.log(`apps/smoke: working directory ${workDir}`);

	// 2. Pack the package into a tarball.
	let tarballName;
	try {
		const packOutput = run('npm', ['pack', '--silent', '--pack-destination', workDir], {
			cwd: pkgDir,
		});
		tarballName = packOutput.trim().split('\n').pop().trim();
	} catch (err) {
		fail(`"npm pack" failed: ${err.message}`);
	}
	const tarballPath = path.join(workDir, tarballName);
	if (!existsSync(tarballPath)) {
		fail(`expected tarball at ${tarballPath} but it was not created.`);
	}

	// 3. Scaffold a minimal Next.js app that imports the package's CSS.
	const appDir = path.join(workDir, 'app-under-test');
	mkdirSync(path.join(appDir, 'app'), { recursive: true });

	writeFileSync(
		path.join(appDir, 'package.json'),
		JSON.stringify(
			{
				name: 'vane-smoke-app',
				private: true,
				version: '0.0.0',
				scripts: { build: 'next build' },
			},
			null,
			2,
		),
	);

	writeFileSync(
		path.join(appDir, 'next.config.mjs'),
		'const nextConfig = {};\nexport default nextConfig;\n',
	);

	writeFileSync(
		path.join(appDir, 'app/layout.tsx'),
		[
			'import "@webinvolve/vane/styles.css";',
			'',
			'export default function RootLayout({ children }: { children: React.ReactNode }) {',
			'  return (',
			'    <html lang="en">',
			'      <body>{children}</body>',
			'    </html>',
			'  );',
			'}',
			'',
		].join('\n'),
	);

	writeFileSync(
		path.join(appDir, 'app/page.tsx'),
		['export default function Page() {', '  return <main data-vane-smoke-test />;', '}', ''].join(
			'\n',
		),
	);

	// 4. Install next/react/react-dom + the packed tarball.
	try {
		run(
			'npm',
			[
				'install',
				'--no-audit',
				'--no-fund',
				'--loglevel=error',
				'next@latest',
				'react@latest',
				'react-dom@latest',
				tarballPath,
			],
			{ cwd: appDir },
		);
	} catch (err) {
		const message = err.stderr?.toString() || err.message;
		if (isNetworkError(message)) {
			skip(`network unavailable during install (${err.message}).`);
		}
		fail(`installing dependencies into the throwaway app failed: ${message}`);
	}

	// 5. Build the throwaway app.
	// Force webpack, not Turbopack (Next's default build tool since Next
	// 15+): `sideEffects` tree-shaking is a webpack optimization, and it is
	// specifically a bad `sideEffects` value that this smoke test exists to
	// catch. A Turbopack build would not exercise that code path.
	try {
		run('npx', ['next', 'build', '--webpack'], { cwd: appDir });
	} catch (err) {
		const message = err.stderr?.toString() || err.message;
		fail(`"next build" failed in the throwaway app: ${message}`);
	}

	// 6. Assert the emitted CSS contains `[data-vane]`.
	// Walk recursively rather than assuming `static/css/`: webpack and
	// Turbopack (Next's default build tool since Next 15+) place emitted
	// CSS in different subdirectories under `.next/static`.
	const staticDir = path.join(appDir, '.next/static');
	if (!existsSync(staticDir)) {
		fail(`expected ${staticDir} to exist after build — Next.js emitted no static output at all.`);
	}

	function findCssFiles(dir, out = []) {
		for (const entry of readdirSync(dir)) {
			const abs = path.join(dir, entry);
			if (statSync(abs).isDirectory()) {
				findCssFiles(abs, out);
			} else if (entry.endsWith('.css')) {
				out.push(abs);
			}
		}
		return out;
	}

	const cssFiles = findCssFiles(staticDir);
	if (cssFiles.length === 0) {
		fail(`no .css files found under ${staticDir}.`);
	}
	const combinedCss = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
	if (!combinedCss.includes('[data-vane]')) {
		fail(
			'the emitted CSS does not contain "[data-vane]" — this is the failure mode of a bad ' +
				'`sideEffects` value in packages/vane/package.json (should be ["*.css"], not false): ' +
				'the bundler tree-shook the CSS import away.',
		);
	}

	console.log('apps/smoke: ok — emitted CSS contains "[data-vane]".');
	rmSync(workDir, { recursive: true, force: true });
}

main().catch((err) => {
	fail(err.stack || err.message);
});
