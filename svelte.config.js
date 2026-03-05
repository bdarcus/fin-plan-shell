import adapter from "@sveltejs/adapter-static";
import { resolveBasePath } from "./base-path.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: "404.html",
		}),
		paths: {
			base: resolveBasePath(),
		},
		alias: {
			"@fin-plan/tips-engine": "./packages/tips-engine/src",
			"@fin-plan/portfolio-engine": "./packages/portfolio-engine/src",
			"@fin-plan/smart-withdrawals-engine":
				"./packages/smart-withdrawals-engine/src",
			"@fin-plan/social-security-engine":
				"./packages/social-security-engine/src",
			"@fin-plan/pension-engine": "./packages/pension-engine/src",
		},
	},
};

export default config;
