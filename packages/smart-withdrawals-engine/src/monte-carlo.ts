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
}

export interface SimulationResult {
	years: number[];
	p5: number[];
	p50: number[];
	p95: number[];
	successRate: number; // Probability of maintaining >80% of median starting income
}

function randn_bm() {
	let u = 0,
		v = 0;
	while (u === 0) u = Math.random();
	while (v === 0) v = Math.random();
	return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarlo(params: MonteCarloParams): SimulationResult {
	const numSims = params.numSims || 1000;
	const startYear = new Date().getFullYear();
	const allSimsIncome: number[][] = Array.from(
		{ length: params.years },
		() => [],
	);

	// Run first year for ALL simulations to find the 'starting target'
	// In Merton, there isn't one fixed target, but we need a baseline for 'resilience'
	const initialMedianIncome = 0;

	for (let s = 0; s < numSims; s++) {
		let currentBalance = params.startBalance;
		const simIncomes: number[] = [];

		for (let y = 0; y < params.years; y++) {
			const year = startYear + y;
			const yearsRemaining = params.years - y;

			const safeIncome = params.incomeStreams.reduce((acc, stream) => {
				return acc + (stream.annualAmounts[year] || 0);
			}, 0);

			const expectedReturn =
				params.equityAllocation * params.equityReturn +
				(1 - params.equityAllocation) * params.tipsReturn;

			let portfolioWithdrawal = 0;
			const bequest = params.bequestTarget || 0;
			if (currentBalance > 0) {
				const rate = expectedReturn;
				if (rate <= 0) {
					portfolioWithdrawal =
						(currentBalance - bequest) / yearsRemaining;
				} else {
					portfolioWithdrawal =
						(currentBalance * rate -
							(bequest * rate) / (1 + rate) ** yearsRemaining) /
						(1 - 1 / (1 + rate) ** yearsRemaining);
				}
			}
			portfolioWithdrawal = Math.max(0, portfolioWithdrawal);

			const totalIncome = safeIncome + portfolioWithdrawal;
			simIncomes.push(totalIncome);
			allSimsIncome[y].push(totalIncome);

			const randomEquityReturn =
				params.equityReturn + randn_bm() * params.equityVol;
			const actualReturn =
				params.equityAllocation * randomEquityReturn +
				(1 - params.equityAllocation) * params.tipsReturn;

			currentBalance =
				(currentBalance - portfolioWithdrawal) * (1 + actualReturn);
			if (currentBalance < 0) currentBalance = 0;
		}
	}

	const p5: number[] = [];
	const p50: number[] = [];
	const p95: number[] = [];
	const yearsArr: number[] = [];

	for (let y = 0; y < params.years; y++) {
		const sorted = allSimsIncome[y].slice().sort((a, b) => a - b);
		p5.push(sorted[Math.floor(numSims * 0.05)]);
		p50.push(sorted[Math.floor(numSims * 0.5)]);
		p95.push(sorted[Math.floor(numSims * 0.95)]);
		yearsArr.push(startYear + y);
	}

	// Calculate 'Resilience': % of years across all sims where income is > 80% of initial median
	const targetFloor = p50[0] * 0.8;
	let aboveFloorCount = 0;
	const totalYears = params.years * numSims;

	for (let y = 0; y < params.years; y++) {
		for (let s = 0; s < numSims; s++) {
			if (allSimsIncome[y][s] >= targetFloor) aboveFloorCount++;
		}
	}

	return {
		years: yearsArr,
		p5,
		p50,
		p95,
		successRate: (aboveFloorCount / totalYears) * 100,
	};
}
