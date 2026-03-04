import { readFileSync } from "fs";
import { join } from "path";
import { parseArgs } from "util";
import { type BondInfo, buildLadder } from "./core";

// A small parser for the existing TipsYields.csv file to test with real data
function loadRealBonds(): BondInfo[] {
	const csvPath = join(process.cwd(), "static/data/TipsYields.csv");
	const content = readFileSync(csvPath, "utf-8");
	const lines = content.trim().split("\n");

	const bonds: BondInfo[] = [];
	for (let i = 1; i < lines.length; i++) {
		if (!lines[i]) continue;
		const cols = lines[i].split(",");
		const maturity = cols[2];
		const price = parseFloat(cols[5]);
		if (Number.isNaN(price)) continue;

		bonds.push({
			cusip: cols[1],
			maturity: maturity,
			coupon: parseFloat(cols[3]),
			baseCpi: parseFloat(cols[4]),
			price: price,
			yield: parseFloat(cols[6]),
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

	const dara = parseFloat(values.dara!);
	const startYear = parseInt(values.start!);
	const endYear = parseInt(values.end!);

	console.log(
		`\n================================================================`,
	);
	console.log(`   TIPS LADDER CALCULATION REPORT: "SHOW YOUR WORK" EDITION`);
	console.log(
		`================================================================`,
	);
	console.log(`Target Annual Real Income (DARA): ${formatCurrency(dara)}`);
	console.log(`Planning Horizon:                 ${startYear} to ${endYear}`);
	console.log(
		`----------------------------------------------------------------\n`,
	);

	try {
		const bonds = loadRealBonds();
		const result = buildLadder(
			bonds,
			dara,
			startYear,
			endYear,
			new Date("2026-03-01"),
		);

		console.log(`[1] FINAL SHOPPING LIST:`);
		console.log(
			`Year | CUSIP     | Qty  | Par Value   | Clean Price | Total Cost`,
		);
		console.log(
			`-----|-----------|------|-------------|-------------|------------`,
		);
		for (const rung of result.rungs) {
			const bond = bonds.find((b) => b.cusip === rung.cusip)!;
			console.log(
				`${rung.year} | ${rung.cusip.padEnd(9)} | ${rung.qty.toString().padEnd(4)} | ${formatCurrency(rung.principal).padEnd(11)} | ${bond.price.toString().padEnd(11)} | ${formatCurrency(rung.cost)}`,
			);
		}
		console.log(
			`----------------------------------------------------------------`,
		);
		console.log(
			`TOTAL INITIAL INVESTMENT: ${formatCurrency(result.totalCost)}`,
		);
		console.log(
			`----------------------------------------------------------------\n`,
		);

		console.log(`[2] VERIFICATION AUDIT (Cumulative Cashflow Simulation):`);
		console.log(`Simulating actual bank balance (Opening + Inflows - Spend)`);
		console.log(
			`----------------------------------------------------------------`,
		);

		let allYearsPass = true;
		let accountBalance = 0;

		for (let y = startYear; y <= endYear; y++) {
			let inflowThisYear = 0;

			for (const rung of result.rungs) {
				const bond = bonds.find((b) => b.cusip === rung.cusip)!;
				const maturityYear = new Date(bond.maturity).getFullYear();

				if (maturityYear === y) {
					inflowThisYear += rung.principal * (1 + bond.coupon / 2);
				} else if (maturityYear > y) {
					inflowThisYear += rung.principal * bond.coupon;
				}
			}

			const totalAvailableBeforeSpend = accountBalance + inflowThisYear;
			const shortfall = Math.max(0, dara - totalAvailableBeforeSpend);

			const status = shortfall <= 0.05 ? "✅ PASS" : "❌ FAIL";
			if (shortfall > 0.05) allYearsPass = false;

			console.log(
				`${y}: ${status} | Opening + Inflow: ${formatCurrency(totalAvailableBeforeSpend).padEnd(11)} | Spend: ${formatCurrency(dara)}`,
			);

			// Final balance for next year
			accountBalance = Math.max(0, totalAvailableBeforeSpend - dara);
		}

		if (allYearsPass) {
			console.log(
				`\nRESULT: Ladder logic is mathematically sound and verified for this data set.`,
			);
		} else {
			console.log(
				`\nRESULT: Shortfalls detected. Increase target or shorten horizon.`,
			);
		}

		console.log(
			`================================================================\n`,
		);
	} catch (e: any) {
		console.error(`Error generating report: ${e.message}`);
	}
}

if (import.meta.main) {
	generateReport();
}
