import type { BondLadder } from "../store/ladder";

/**
 * Returns whether a ladder should count as active for the supplied calendar year.
 */
export function isLadderActiveInYear(
	ladder: Pick<BondLadder, "startYear" | "endYear">,
	year: number,
): boolean {
	return ladder.startYear <= year && ladder.endYear >= year;
}

/**
 * Filters a collection of ladders to only those active in the supplied year.
 */
export function getActiveLadders(
	ladders: BondLadder[],
	year: number,
): BondLadder[] {
	return ladders.filter((ladder) => isLadderActiveInYear(ladder, year));
}

/**
 * Sums the annual income contributed by ladders active in the supplied year.
 */
export function getActiveLadderIncome(
	ladders: BondLadder[],
	year: number,
): number {
	return getActiveLadders(ladders, year).reduce(
		(sum, ladder) => sum + ladder.annualIncome,
		0,
	);
}
