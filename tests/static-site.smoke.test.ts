import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const buildDir = join(process.cwd(), "build");
const portfolioStorePath = join(
	process.cwd(),
	"src/lib/modules/portfolio-manager/store/portfolio.ts",
);
const hasBuild = existsSync(buildDir);

function getEntryHtml(): string {
	if (existsSync(join(buildDir, "index.html"))) {
		return readFileSync(join(buildDir, "index.html"), "utf8");
	}
	return readFileSync(join(buildDir, "404.html"), "utf8");
}

function detectSerializedBase(html: string): string {
	const match = html.match(/base:\s*"([^"]*)"/);
	return match?.[1] ?? "";
}

describe("static site smoke checks", () => {
	test("build artifacts exist", () => {
		if (!hasBuild) return;

		expect(existsSync(join(buildDir, "404.html"))).toBeTrue();
		expect(
			existsSync(join(buildDir, "data", "MarketAssumptions.json")),
		).toBeTrue();
	});

	test("entry HTML files use a consistent base-prefixed asset path", () => {
		if (!hasBuild) return;

		const entryHtml = getEntryHtml();
		const fallbackHtml = readFileSync(join(buildDir, "404.html"), "utf8");
		const entryBase = detectSerializedBase(entryHtml);
		const fallbackBase = detectSerializedBase(fallbackHtml);
		const expectedAssetPrefix = `${entryBase}/_app/`;

		expect(entryHtml).toContain(expectedAssetPrefix);
		expect(fallbackHtml).toContain(expectedAssetPrefix);
		expect(fallbackBase).toBe(entryBase);
	});

	test('portfolio store uses base-aware assumptions URL and avoids hardcoded fetch("/data/...")', () => {
		const source = readFileSync(portfolioStorePath, "utf8");
		expect(source).toContain("fetch(`${base}/data/MarketAssumptions.json`)");
		expect(source).not.toContain('fetch("/data/MarketAssumptions.json")');
	});
});
