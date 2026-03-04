import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		fs: {
			// Allow access to linked modules outside the project root
			allow: [".."],
		},
	},
	optimizeDeps: {
		// Prevent pre-bundling of the linked module for better DX
		exclude: ["@brucedarcus/tips-ladder"],
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: "./vite.config.ts",
				test: {
					name: "client",
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: "chromium", headless: true }],
					},
					include: [
						"src/**/*.svelte.{test,spec}.{js,ts}",
						"src/**/*.spec.browser.ts",
					],
					exclude: ["src/lib/server/**"],
				},
			},
			{
				extends: "./vite.config.ts",
				test: {
					name: "server",
					environment: "jsdom",
					include: [
						"src/**/*.{test,spec}.{js,ts}",
						"tests/**/*.{test,spec}.{js,ts}",
					],
					exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
				},
			},
		],
	},
});
