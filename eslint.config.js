import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import svelteParser from "svelte-eslint-parser";
import ts from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs["flat/recommended"],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},
	},
	{
		files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
			},
		},
		rules: {
			// Svelte templates/runes can trigger false positives with core no-undef.
			"no-undef": "off",
		},
	},
	{
		ignores: [
			"build/",
			"docs/api/",
			".svelte-kit/",
			"dist/",
			"node_modules/",
			"package/",
			".env",
			".env.*",
			"!.env.example",
		],
	},
	{
		rules: {
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"svelte/no-at-html-tags": "warn",
		},
	},
];
