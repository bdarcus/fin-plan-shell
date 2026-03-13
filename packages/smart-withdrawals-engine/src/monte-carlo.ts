export interface IncomeStream {
	id: string;
	name: string;
	annualAmounts: Record<number, number>;
	isGuaranteed: boolean;
	hasCOLA: boolean;
	taxStatus: "taxable" | "tax-free" | "tax-deferred";
}

export interface MonteCarloParams {
	startBalance: number;
	equityAllocation: number;
	years: number;
	equityReturn: number;
	equityVol: number;
	tipsReturn: number;
	bequestTarget: number;
	incomeStreams: IncomeStream[];
	numSims?: number;
	seed?: number;
	spendingFloor?: number;
}

export interface SimulationResult {
	years: number[];
	p5: number[];
	p50: number[];
	p95: number[];
	floorBreachPathRate: number;
	floorBreachYearRate: number[];
	medianShortfallWhenBreached: number;
	worstRunLengthP95: number;
	spendingFloor: number;
}

/**
 * Creates a deterministic uniform RNG so simulations are repeatable for tests and UI.
 */
function createSeededUniform(seed: number): () => number {
	let t = seed >>> 0;
	return () => {
		t += 0x6d2b79f5;
		let x = Math.imul(t ^ (t >>> 15), t | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Samples a standard normal deviate using the Box-Muller transform.
 */
function randnBm(uniform: () => number) {
	let u = 0,
		v = 0;
	while (u === 0) u = uniform();
	while (v === 0) v = uniform();
	return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Returns an order-statistic quantile from a numeric sample.
 */
function quantile(values: number[], q: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q));
	return sorted[idx];
}

/**
 * Solves for the sustainable annual portfolio withdrawal given a bequest goal.
 */
function calculateWithdrawal(
	currentBalance: number,
	expectedReturn: number,
	yearsRemaining: number,
	bequest: number,
): number {
	if (currentBalance <= 0 || yearsRemaining <= 0) return 0;
	if (expectedReturn <= 0) {
		return Math.max(0, (currentBalance - bequest) / yearsRemaining);
	}
	return Math.max(
		0,
		(currentBalance * expectedReturn -
			(bequest * expectedReturn) / (1 + expectedReturn) ** yearsRemaining) /
			(1 - 1 / (1 + expectedReturn) ** yearsRemaining),
	);
}

/**
 * Runs the Monte Carlo retirement-income simulation and summarizes the outcome bands.
 */
export function runMonteCarlo(params: MonteCarloParams): SimulationResult {
	const numSims = params.numSims || 1000;
	const startYear = new Date().getFullYear();
	const uniform = createSeededUniform(params.seed ?? 42);
	const expectedReturn =
		params.equityAllocation * params.equityReturn +
		(1 - params.equityAllocation) * params.tipsReturn;
	const initialSafeIncome = params.incomeStreams.reduce((acc, stream) => {
		return acc + (stream.annualAmounts[startYear] || 0);
	}, 0);
	const defaultFloor =
		initialSafeIncome +
		calculateWithdrawal(
			params.startBalance,
			expectedReturn,
			params.years,
			params.bequestTarget || 0,
		);
	const spendingFloor = params.spendingFloor ?? defaultFloor;

	const allSimsIncome: number[][] = Array.from(
		{ length: params.years },
		() => [],
	);
	const pathBreaches: boolean[] = [];
	const shortfallsWhenBreached: number[] = [];
	const longestBreachRuns: number[] = [];

	for (let s = 0; s < numSims; s++) {
		let currentBalance = params.startBalance;
		let breached = false;
		let currentBreachRun = 0;
		let longestBreachRun = 0;

		for (let y = 0; y < params.years; y++) {
			const year = startYear + y;
			const yearsRemaining = params.years - y;

			const safeIncome = params.incomeStreams.reduce((acc, stream) => {
				return acc + (stream.annualAmounts[year] || 0);
			}, 0);

			const bequest = params.bequestTarget || 0;
			const portfolioWithdrawal = calculateWithdrawal(
				currentBalance,
				expectedReturn,
				yearsRemaining,
				bequest,
			);

			const totalIncome = safeIncome + portfolioWithdrawal;
			allSimsIncome[y].push(totalIncome);
			if (totalIncome < spendingFloor) {
				breached = true;
				currentBreachRun++;
				shortfallsWhenBreached.push(spendingFloor - totalIncome);
				if (currentBreachRun > longestBreachRun) {
					longestBreachRun = currentBreachRun;
				}
			} else {
				currentBreachRun = 0;
			}

			const randomEquityReturn =
				params.equityReturn + randnBm(uniform) * params.equityVol;
			const actualReturn =
				params.equityAllocation * randomEquityReturn +
				(1 - params.equityAllocation) * params.tipsReturn;

			currentBalance =
				(currentBalance - portfolioWithdrawal) * (1 + actualReturn);
			if (currentBalance < 0) currentBalance = 0;
		}
		pathBreaches.push(breached);
		longestBreachRuns.push(longestBreachRun);
	}

	const p5: number[] = [];
	const p50: number[] = [];
	const p95: number[] = [];
	const yearsArr: number[] = [];
	const floorBreachYearRate: number[] = [];

	for (let y = 0; y < params.years; y++) {
		const sorted = [...allSimsIncome[y]].sort((a, b) => a - b);
		p5.push(quantile(sorted, 0.05));
		p50.push(quantile(sorted, 0.5));
		p95.push(quantile(sorted, 0.95));
		const breaches = allSimsIncome[y].filter(
			(income) => income < spendingFloor,
		).length;
		floorBreachYearRate.push((breaches / numSims) * 100);
		yearsArr.push(startYear + y);
	}
	const breachedPaths = pathBreaches.filter(Boolean).length;
	const floorBreachPathRate = (breachedPaths / numSims) * 100;
	const medianShortfallWhenBreached = quantile(shortfallsWhenBreached, 0.5);
	const worstRunLengthP95 = quantile(longestBreachRuns, 0.95);

	return {
		years: yearsArr,
		p5,
		p50,
		p95,
		floorBreachPathRate,
		floorBreachYearRate,
		medianShortfallWhenBreached,
		worstRunLengthP95,
		spendingFloor,
	};
}
