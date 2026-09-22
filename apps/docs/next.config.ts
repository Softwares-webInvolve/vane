import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
	// The demo consumes @webinvolve/vane straight from the workspace (no
	// publish step) — transpilePackages lets Next.js's own build pipeline
	// process the package's TypeScript-shaped output like first-party code.
	transpilePackages: ['@webinvolve/vane'],
	// Next 16 auto-generates AGENTS.md/CLAUDE.md on first `dev`/`build` run;
	// this repo manages its own memory files, so that's noise, not signal.
	agentRules: false,
};

export default nextConfig;
