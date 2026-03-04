import type { MarketAssumptions } from "../store/portfolio";

export async function fetchElmMarketAssumptions(): Promise<MarketAssumptions> {
	return {
		equityRealReturn: 0.037,
		equityYield: 0.021,
		tipsRealReturn: 0.019,
		tipsRealYield: 0.019,
		inflation: 0.021,
		updatedAt: new Date().toISOString().split("T")[0],
	};
}
