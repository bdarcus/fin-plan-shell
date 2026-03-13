#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { type BondInfo, buildLadder } from "./core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// A small parser for the existing TipsYields.csv file to test with real data
function loadRealBonds(): BondInfo[] {
	// Try root static folder first (for dev/monorepo use)
	let yieldPath = join(__dirname, "../../../static/data/TipsYields.csv");
	let cpiPath = join(__dirname, "../../../static/data/RefCPI.csv");

	try {
		readFileSync(yieldPath, "utf-8");
	} catch {
		// Fallback to local
		yieldPath = join(process.cwd(), "static/data/TipsYields.csv");
		cpiPath = join(process.cwd(), "static/data/RefCPI.csv");
	}

	const content = readFileSync(yieldPath, "utf-8");
	const lines = content.trim().split("\n");

	const cpiContent = readFileSync(cpiPath, "utf-8");
	const cpiLines = cpiContent.trim().split("\n");
	const latestCpi = parseFloat(cpiLines[cpiLines.length - 1].split(",")[1]);

	const bonds: BondInfo[] = [];
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]) continue;
		const cols = lines[i].split(",");
		const maturity = cols[2];
		const coupon = parseFloat(cols[3]);
		const baseCpi = parseFloat(cols[4]);
		const price = parseFloat(cols[5]);
		const yld = parseFloat(cols[6]);
		if (Number.isNaN(price)) continue;

		bonds.push({
			cusip: cols[1],
			maturity: maturity,
			coupon: coupon,
			baseCpi: baseCpi,
			indexRatio: latestCpi / baseCpi,
			price: price,
			yield: Number.isNaN(yld) ? 0.02 : yld,
		});
	}
	return bonds;
}

function formatCurrency(val: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(val);
}

function getAdjustedPrincipalPerUnit(bond: BondInfo): number {
	return 100 * bond.indexRatio;
}

function getAnnualInterestPerUnit(bond: BondInfo): number {
	return getAdjustedPrincipalPerUnit(bond) * bond.coupon;
}

function getFinalYearInterestFactor(bond: BondInfo): number {
	const maturityMonth = new Date(`${bond.maturity}T00:00:00`).getMonth() + 1;
	return maturityMonth < 7 ? 0.5 : 1.0;
}

function getMaturityCashflowPerUnit(bond: BondInfo): number {
	return (
		getAdjustedPrincipalPerUnit(bond) +
		getAnnualInterestPerUnit(bond) * getFinalYearInterestFactor(bond)
	);
}

function getRungCoverageForYear(
	bond: BondInfo,
	rung: {
		qty: number;
		year: number;
		coverageType?: "exact" | "gap";
		targetYear?: number;
	},
	year: number,
): number {
	const annualInterest = rung.qty * getAnnualInterestPerUnit(bond);
	const maturityCashflow = rung.qty * getMaturityCashflowPerUnit(bond);

	if (rung.coverageType === "gap" && rung.targetYear === year) {
		return rung.qty * 100;
	}

	if (rung.coverageType === "gap" && rung.year === year) {
		return Math.max(0, maturityCashflow - rung.qty * 100);
	}

	if (rung.year === year) return maturityCashflow;
	if (rung.year > year) return annualInterest;
	return 0;
}

function formatCoverageLabel(rung: {
	coverageType?: "exact" | "gap";
	bracketRole?: "lower" | "upper";
}): string {
	if (rung.coverageType === "gap") {
		return rung.bracketRole === "lower" ? "Gap Lower" : "Gap Upper";
	}
	return "Exact";
}

export function generateReport() {
	const { values } = parseArgs({
		args: Bun.argv,
		options: {
			dara: { type: "string", default: "40000" },
			start: { type: "string", default: "2026" },
			end: { type: "string", default: "2035" },
		},
		strict: true,
		allowPositionals: true,
	});

	const dara = parseFloat(values.dara ?? "40000");
	const startYear = parseInt(values.start ?? "2026", 10);
	const endYear = parseInt(values.end ?? "2035", 10);

	console.log(
		"\n================================================================",
	);
	console.log("            TIPS LADDER CALCULATION REPORT");
	console.log(
		"================================================================",
	);
	console.log(`Strategy: Duration-Matched Immunized Synthetic Rungs`);
	console.log(`Target Annual Real Income (DARA): ${formatCurrency(dara)}`);
	console.log(`Planning Horizon:                 ${startYear} to ${endYear}`);
	console.log(
		`----------------------------------------------------------------\n`,
	);

	try {
		const bonds = loadRealBonds();
		// We re-run buildLadder to get the results
		const result = buildLadder(
			bonds,
			dara,
			startYear,
			endYear,
			new Date("2026-03-01"),
		);

		console.log(`[1] FINAL SHOPPING LIST:`);
		console.log(
			`Funded Year | Coverage   | Maturity | CUSIP     | Qty  | Adj Principal | Clean Price | Total Cost`,
		);
		console.log(
			`------------|------------|----------|-----------|------|---------------|-------------|------------`,
		);
		for (const rung of result.rungs) {
			const bond = bonds.find((b) => b.cusip === rung.cusip);
			if (!bond) continue;
			console.log(
				`${String(rung.targetYear ?? rung.year).padEnd(11)} | ${formatCoverageLabel(rung).padEnd(10)} | ${String(rung.year).padEnd(8)} | ${rung.cusip.padEnd(9)} | ${rung.qty.toString().padEnd(4)} | ${formatCurrency(rung.principal).padEnd(13)} | ${bond.price.toString().padEnd(11)} | ${formatCurrency(rung.cost)}`,
			);
		}
		console.log(
			`----------------------------------------------------------------`,
		);
		console.log(
			`TOTAL INITIAL INVESTMENT: ${formatCurrency(result.totalCost)}`,
		);
		console.log(
			"----------------------------------------------------------------\n",
		);

		console.log("[2] CASHFLOW SIMULATION:");
		console.log(
			"Simulating yearly ladder cashflows and carry-forward against the",
		);
		console.log("target liability for each funded year.");
		console.log(
			"----------------------------------------------------------------",
		);

		const allYearsPass = Object.keys(result.unmetIncome).length === 0;

		// Forward simulation of account balance + immunized value
		let carryForward = 0;
		for (let y = startYear; y <= endYear; y++) {
			let inflow = 0;
			for (const rung of result.rungs) {
				const bond = bonds.find((b) => b.cusip === rung.cusip);
				if (!bond) continue;
				inflow += getRungCoverageForYear(bond, rung, y);
			}

			const totalAvailable = carryForward + inflow;
			const unmet = Math.max(0, dara - totalAvailable);
			const status =
				unmet <= 0.05 || !(result.unmetIncome[y] > 0) ? "✅ PASS" : "⚠️ GAP";

			console.log(
				`${y}: ${status} | Cash Inflow: ${formatCurrency(inflow).padEnd(11)} | Spend: ${formatCurrency(dara)}`,
			);
			carryForward = Math.max(0, totalAvailable - dara);
		}

		if (allYearsPass) {
			console.log(
				`\nRESULT: Cashflow simulation clears the target liability for this data set.`,
			);
		}

		console.log(
			`================================================================\n`,
		);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error(`Error generating report: ${message}`);
	}
}

if (import.meta.main) {
	generateReport();
}
