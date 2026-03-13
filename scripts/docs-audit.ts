#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
	"node_modules",
	".svelte-kit",
	"build",
	"dist",
	"package",
]);
const EXPORTED_ROOTS = ["packages", "src/lib/shared"];
const INTERNAL_ALLOWLIST = new Set([
	"packages/tips-engine/src/core.ts",
	"packages/tips-engine/src/market-data.ts",
	"packages/tips-engine/src/fedinvest.ts",
	"packages/smart-withdrawals-engine/src/monte-carlo.ts",
]);

type Finding = {
	file: string;
	line: number;
	name: string;
	scope: "exported" | "internal";
};

function walk(dir: string): string[] {
	const files: string[] = [];

	for (const name of readdirSync(dir)) {
		if (EXCLUDED_DIRS.has(name)) continue;
		const fullPath = join(dir, name);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...walk(fullPath));
			continue;
		}

		const extension = extname(fullPath);
		if (![".ts", ".js"].includes(extension)) continue;
		if (fullPath.endsWith(".d.ts")) continue;
		if (/\.(test|spec)\./.test(fullPath)) continue;
		if (fullPath.endsWith(".svelte.ts") || fullPath.endsWith(".svelte.js")) {
			continue;
		}

		files.push(fullPath);
	}

	return files;
}

function hasDocBlock(lines: string[], index: number): boolean {
	let cursor = index - 1;
	while (cursor >= 0 && lines[cursor].trim() === "") cursor -= 1;
	if (cursor < 0) return false;

	if (lines[cursor].trim().startsWith("/**")) return true;
	if (!lines[cursor].includes("*/")) return false;

	while (cursor >= 0) {
		const line = lines[cursor].trim();
		if (line.startsWith("/**")) return true;
		if (line.startsWith("/*")) return false;
		cursor -= 1;
	}

	return false;
}

function collectFindings(filePath: string): Finding[] {
	const relPath = relative(ROOT, filePath);
	const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
	const findings: Finding[] = [];
	const checkExports = EXPORTED_ROOTS.some(
		(root) => relPath === root || relPath.startsWith(`${root}/`),
	);
	const checkInternals = INTERNAL_ALLOWLIST.has(relPath);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const exportedMatch = line.match(
			/^export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/,
		);
		if (exportedMatch && checkExports && !hasDocBlock(lines, index)) {
			findings.push({
				file: relPath,
				line: index + 1,
				name: exportedMatch[1],
				scope: "exported",
			});
			continue;
		}

		const internalMatch = line.match(/^function\s+([A-Za-z0-9_]+)\s*\(/);
		if (internalMatch && checkInternals && !hasDocBlock(lines, index)) {
			findings.push({
				file: relPath,
				line: index + 1,
				name: internalMatch[1],
				scope: "internal",
			});
		}
	}

	return findings;
}

const files = walk(ROOT);
const findings = files.flatMap(collectFindings);

if (findings.length > 0) {
	console.error("Missing documentation blocks for audited functions:\n");
	for (const finding of findings) {
		console.error(
			`- [${finding.scope}] ${finding.file}:${finding.line} ${finding.name}`,
		);
	}
	process.exit(1);
}

console.log(
	`docs:audit passed for ${files.length} source files (${INTERNAL_ALLOWLIST.size} internal-helper files checked).`,
);
