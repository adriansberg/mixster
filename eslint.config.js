import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';

export default [
	js.configs.recommended,
	{
		files: ['**/*.{js,ts,svelte}'],
		plugins: {
			'@typescript-eslint': tseslint
		},
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-undef': 'off'
		}
	},
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsparser
			}
		},
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	prettier,
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'node_modules/**',
			'.vercel/**',
			'.vite-pwa/**',
			'src/lib/components/ui/**'
		]
	}
];
