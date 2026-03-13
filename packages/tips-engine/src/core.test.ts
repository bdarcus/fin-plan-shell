import { expect, test, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BondInfo, buildLadder, calculateRebalance } from "./core";
import { loadTipsSnapshot20260302 } from "./test-fixtures/tips-market-2026-03-02";
import { loadTipsSnapshot20260312 } from "./test-fixtures/tips-market-2026-03-12";

// A small parser for the existing TipsYields.csv file to test with real data
function loadRealBonds(): BondInfo[] {
	const csvPath = join(process.cwd(), "static/data/TipsYields.csv");
	const content = readFileSync(csvPath, "utf-8");
	const lines = content.trim().split("\n");
	// settlementDate,cusip,maturity,coupon,baseCpi,price,yield
	const _headers = lines[0].split(",");

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
			indexRatio: 1.0, // Default for tests unless parsing RefCPI
			price: price,
			yield: parseFloat(cols[6]),
		});
	}
	return bonds;
}

function mapToBonds(
	map: Map<
		string,
		{
			cusip: string;
			maturity: string;
			coupon: number;
			price: number | null;
			baseCpi: number;
			indexRatio: number;
			yield: number | null;
		}
	>,
): BondInfo[] {
	return [...map.values()].map((bond) => ({
		cusip: bond.cusip,
		maturity: bond.maturity,
		coupon: bond.coupon,
		price: bond.price ?? 100,
		baseCpi: bond.baseCpi,
		indexRatio: bond.indexRatio,
		yield: bond.yield ?? 0,
	}));
}

test("buildLadder generates a ladder for 5 years", () => {
	const bonds = loadRealBonds();
	const startYear = 2026;
	const endYear = 2030;
	const targetIncome = 40000;

	const result = buildLadder(
		bonds,
		targetIncome,
		startYear,
		endYear,
		new Date("2026-03-01"),
	);

	expect(result.rungs.length).toBeGreaterThan(0);
	expect(result.totalCost).toBeGreaterThan(0);

	// Verify unmet income is empty (no gaps in 2026-2030 usually)
	const gapYears = Object.keys(result.unmetIncome);
	expect(gapYears.length).toBe(0);

	// Verify first rung is 2026
	expect(result.rungs[0].year).toBe(2026);

	// Verify total cashflow roughly equals targetIncome for 2026
	// In 2026, we get: maturity of 2026 bond + half year coupon of 2026 bond
	// + full year coupons of 2027, 2028, 2029, 2030 bonds.
	// Let's manually sum it up:
	const rung26 = result.rungs.find((r) => r.year === 2026);
	let income26 = 0;
	if (rung26) {
		const bond26 = bonds.find((b) => b.cusip === rung26.cusip);
		if (bond26) {
			income26 += rung26.principal + (rung26.principal * bond26.coupon) / 2;
		}
	}

	for (const r of result.rungs) {
		if (r.year > 2026) {
			const b = bonds.find((bond) => bond.cusip === r.cusip);
			if (b) {
				income26 += r.principal * b.coupon;
			}
		}
	}

	// Should be very close to 40000. It might be slightly higher because we rounded qty up to whole bonds.
	expect(income26).toBeGreaterThanOrEqual(targetIncome);
	expect(income26).toBeLessThan(targetIncome + 2000); // within a reasonable rounding margin
});

const mockBonds: BondInfo[] = [
	{
		cusip: "BOND26",
		maturity: "2026-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND27",
		maturity: "2027-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND29",
		maturity: "2029-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
	{
		cusip: "BOND30",
		maturity: "2030-01-15",
		coupon: 0.05,
		price: 100,
		baseCpi: 100,
		indexRatio: 1,
		yield: 0.05,
	},
];

test("Pre-ladder interest reduces total cost (integration)", () => {
	const startYear = 2029;
	const endYear = 2030;
	const targetIncome = 10000;
	const settlementDate = new Date("2026-01-01");

	const resultWithoutInterest = buildLadder(
		mockBonds,
		targetIncome,
		startYear,
		endYear,
		{
			settlementDate,
			usePreLadderInterest: false,
			modelFidelity: "annual-approx",
		},
	);

	const resultWithInterest = buildLadder(
		mockBonds,
		targetIncome,
		startYear,
		endYear,
		{
			settlementDate,
			usePreLadderInterest: true,
			modelFidelity: "annual-approx",
		},
	);

	expect(resultWithInterest.totalCost).toBeLessThan(
		resultWithoutInterest.totalCost,
	);
});

test("Adjusted principal sizing uses index ratio in exact-year P+I and coupon drip", () => {
	const bonds: BondInfo[] = [
		{
			cusip: "ADJ-2026",
			maturity: "2026-01-15",
			coupon: 0.05,
			price: 100,
			baseCpi: 100,
			indexRatio: 1.2,
			yield: 0.05,
		},
		{
			cusip: "ADJ-2027",
			maturity: "2027-01-15",
			coupon: 0.05,
			price: 100,
			baseCpi: 100,
			indexRatio: 1.2,
			yield: 0.05,
		},
	];

	const result = buildLadder(bonds, 12000, 2026, 2027, {
		settlementDate: new Date("2026-01-01"),
		modelFidelity: "annual-approx",
	});
	const rung2027 = result.rungs.find((r) => r.cusip === "ADJ-2027");
	const rung2026 = result.rungs.find((r) => r.cusip === "ADJ-2026");

	expect(rung2027?.qty).toBe(98);
	expect(rung2027?.principal).toBeCloseTo(11760, 6);
	expect(rung2027?.couponIncome).toBeCloseTo(588, 6);
	expect(rung2026?.qty).toBe(93);
	expect(rung2026?.principal).toBeCloseTo(11160, 6);
});

test("Jan maturities get half-year final interest while Jul maturities get full-year interest", () => {
	const januaryBond: BondInfo[] = [
		{
			cusip: "JAN-2026",
			maturity: "2026-01-15",
			coupon: 0.04,
			price: 100,
			baseCpi: 100,
			indexRatio: 1.1,
			yield: 0.04,
		},
	];
	const julyBond: BondInfo[] = [
		{
			cusip: "JUL-2026",
			maturity: "2026-07-15",
			coupon: 0.04,
			price: 100,
			baseCpi: 100,
			indexRatio: 1.1,
			yield: 0.04,
		},
	];

	const january = buildLadder(januaryBond, 10000, 2026, 2026, {
		settlementDate: new Date("2026-01-01"),
		modelFidelity: "annual-approx",
	});
	const july = buildLadder(julyBond, 10000, 2026, 2026, {
		settlementDate: new Date("2026-01-01"),
		modelFidelity: "annual-approx",
	});

	expect(january.rungs[0]?.qty).toBe(90);
	expect(july.rungs[0]?.qty).toBe(88);
	expect(july.totalCost).toBeLessThan(january.totalCost);
});

test("March 12 snapshot stays near March 2 cost but in the post-fix range", () => {
	const march2 = buildLadder(
		mapToBonds(loadTipsSnapshot20260302()),
		60000,
		2032,
		2046,
		{ settlementDate: new Date("2026-03-02") },
	);
	const march12 = buildLadder(
		mapToBonds(loadTipsSnapshot20260312()),
		60000,
		2032,
		2046,
		{ settlementDate: new Date("2026-03-12") },
	);
	const deltaFraction =
		Math.abs(march12.totalCost - march2.totalCost) / march2.totalCost;
	const lowerGapUnits =
		march12.positions
			.filter(
				(position) =>
					position.coverageType === "gap" && position.bracketRole === "lower",
			)
			.reduce((sum, position) => sum + position.qty, 0) / 10;
	const upperGapUnits =
		march12.positions
			.filter(
				(position) =>
					position.coverageType === "gap" && position.bracketRole === "upper",
			)
			.reduce((sum, position) => sum + position.qty, 0) / 10;

	expect(deltaFraction).toBeLessThan(0.05);
	expect(march12.totalCost).toBeGreaterThan(730000);
	expect(march12.totalCost).toBeLessThan(820000);
	expect(lowerGapUnits).toBeGreaterThan(75);
	expect(lowerGapUnits).toBeLessThan(82);
	expect(upperGapUnits).toBeGreaterThan(54);
	expect(upperGapUnits).toBeLessThan(63);
});

test("Known external difference: engine keeps Jul 2032 while tipsladder.com export shows Apr 2032", () => {
	const result = buildLadder(
		mapToBonds(loadTipsSnapshot20260312()),
		60000,
		2032,
		2046,
		{ settlementDate: new Date("2026-03-12") },
	);
	const exact2032 = result.positions.find(
		(position) =>
			position.coverageType === "exact" && position.targetYear === 2032,
	);
	const csvPath = join(
		process.cwd(),
		"packages/tips-engine/src/test-fixtures/tipsladder-portfolio-2026-03-12.csv",
	);
	const exported2032Cusip = readFileSync(csvPath, "utf-8")
		.trim()
		.split("\n")
		.map((line) => line.split(",").map((part) => part.trim()))
		.find(([, , year]) => year === "2032")?.[0];

	expect(exact2032?.cusip).toBe("91282CEZ0");
	expect(exported2032Cusip).toBe("912810FQ6");
});

describe("Rebalance Logic", () => {
	test("calculateRebalance identifies gap-filling upgrades", () => {
		// 1. Initial ladder with a gap in 2035
		const initialBonds: BondInfo[] = [
			{
				cusip: "B2030",
				maturity: "2030-01-15",
				coupon: 0,
				price: 100,
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
			{
				cusip: "B2040",
				maturity: "2040-01-15",
				coupon: 0,
				price: 100,
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
		];

		const initialResult = buildLadder(initialBonds, 30000, 2030, 2040, {
			settlementDate: new Date("2026-01-01"),
		});
		const initialHoldings = initialResult.rungs.map((r) => ({
			cusip: r.cusip,
			qty: r.qty,
		}));

		// 2. New bond for 2035 appears
		const newBonds: BondInfo[] = [
			...initialBonds,
			{
				cusip: "B2035",
				maturity: "2035-01-15",
				coupon: 0.1, // 10% coupon makes it much more efficient
				price: 100,
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
		];

		const rebalance = calculateRebalance(
			newBonds,
			initialHoldings,
			30000,
			2030,
			2040,
			{
				settlementDate: new Date("2026-01-01"),
			},
		);

		// 3. Verify intent
		const buy2035 = rebalance.trades.find(
			(t) => t.cusip === "B2035" && t.action === "BUY",
		);

		expect(buy2035).toBeDefined();
		// In this specific mock, it might be picked as gap-bridge for adjacent years
		expect(["exact-match", "gap-bridge"]).toContain(buy2035?.intent as string);

		const gapBridgeSells = rebalance.trades.filter(
			(t) => t.action === "SELL" && t.intent === "gap-bridge",
		);
		expect(gapBridgeSells.length).toBeGreaterThan(0);
	});

	test("Sticky rebalance prefers existing holdings", () => {
		const currentBonds: BondInfo[] = [
			{
				cusip: "HOLD_ME",
				maturity: "2030-01-15",
				coupon: 0,
				price: 100.5, // Slightly more expensive
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
			{
				cusip: "CHEAP_ME",
				maturity: "2030-01-15",
				coupon: 0,
				price: 100.0, // Cheaper
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
		];

		const holdings = [{ cusip: "HOLD_ME", qty: 100 }];

		const rebalance = calculateRebalance(
			currentBonds,
			holdings,
			10000,
			2030,
			2030,
			{
				settlementDate: new Date("2026-01-01"),
				holdingPreferenceWeight: 0.9, // 10% preference
			},
		);

		// Should suggest HOLDING the existing bond instead of switching to the cheaper one
		const holdTrade = rebalance.trades.find((t) => t.cusip === "HOLD_ME");
		expect(holdTrade?.action).toBe("HOLD");
		expect(
			rebalance.trades.find((t) => t.cusip === "CHEAP_ME"),
		).toBeUndefined();
	});

	test("minTradeQtyThreshold filters small trades", () => {
		const bonds: BondInfo[] = [
			{
				cusip: "B2030",
				maturity: "2030-01-15",
				coupon: 0,
				price: 100,
				baseCpi: 100,
				indexRatio: 1,
				yield: 0.01,
			},
		];

		// Initial holding is 100. Target will be 100.0001 (due to rounding/math).
		// We want it to STAY as HOLD 100 if the difference is < threshold.
		const holdings = [{ cusip: "B2030", qty: 100 }];

		const rebalance = calculateRebalance(
			bonds,
			holdings,
			10005, // Slightly more income, needs 100.05 qty -> round up to 101?
			// Wait, buildLadder uses Math.ceil, so 100.05 becomes 101.
			// Diff is 1. If threshold is 5, it should stay 100.
			2030,
			2030,
			{
				settlementDate: new Date("2026-01-01"),
				minTradeQtyThreshold: 5,
			},
		);

		const trade = rebalance.trades.find((t) => t.cusip === "B2030");
		expect(trade?.action).toBe("HOLD");
		expect(trade?.qty).toBe(100);
	});
});
