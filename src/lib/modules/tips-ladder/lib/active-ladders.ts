import type { BondLadder } from "../store/ladder";

export function isLadderActiveInYear(
	ladder: Pick<BondLadder, "startYear" | "endYear">,
	year: number,
): boolean {
	return ladder.startYear <= year && ladder.endYear >= year;
}

export function getActiveLadders(
	ladders: BondLadder[],
	year: number,
): BondLadder[] {
	return ladders.filter((ladder) => isLadderActiveInYear(ladder, year));
}

export function getActiveLadderIncome(
	ladders: BondLadder[],
	year: number,
): number {
	return getActiveLadders(ladders, year).reduce(
		(sum, ladder) => sum + ladder.annualIncome,
		0,
	);
}
