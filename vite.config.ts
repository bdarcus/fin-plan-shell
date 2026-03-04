import path from "path";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			"@fin-plan/tips-engine": path.resolve(__dirname, "./packages/tips-engine/src"),
			"@fin-plan/portfolio-engine": path.resolve(__dirname, "./packages/portfolio-engine/src"),
			"@fin-plan/smart-withdrawals-engine": path.resolve(__dirname, "./packages/smart-withdrawals-engine/src"),
			"@fin-plan/social-security-engine": path.resolve(__dirname, "./packages/social-security-engine/src"),
			"@fin-plan/pension-engine": path.resolve(__dirname, "./packages/pension-engine/src"),
		},
	},
	server: {
		fs: {
			// Allow access to linked modules outside the project root
			allow: [".."],
		},
	},
	optimizeDeps: {
		// Prevent pre-bundling of the linked modules for better DX
		exclude: [
			"@fin-plan/tips-engine",
			"@fin-plan/portfolio-engine",
			"@fin-plan/smart-withdrawals-engine",
			"@fin-plan/social-security-engine",
			"@fin-plan/pension-engine",
		],
	},
	ssr: {
		noExternal: [
			"@fin-plan/tips-engine",
			"@fin-plan/portfolio-engine",
			"@fin-plan/smart-withdrawals-engine",
			"@fin-plan/social-security-engine",
			"@fin-plan/pension-engine",
		],
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
