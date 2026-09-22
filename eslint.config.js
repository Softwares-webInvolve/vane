// Flat ESLint config for the vane monorepo.
//
// Kept intentionally minimal — recommended TypeScript rules plus the one
// rule that matters for this codebase: `packages/vane/src/core/**` must
// stay framework-free (no React import), because it is plain DOM code a
// Vue/Svelte port would reuse. See CLAUDE.md / the plan's "Boundary rules".
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'**/.next/**',
			'**/coverage/**',
			'**/*.config.js',
			'**/*.config.mjs',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	reactHooks.configs['recommended-latest'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		files: ['packages/vane/src/core/**/*.{ts,tsx}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
							message:
								'src/core/** must not import React — it is plain DOM code, reusable by a Vue/Svelte port. Put React-dependent code in src/react/**.',
						},
					],
				},
			],
		},
	},
);
