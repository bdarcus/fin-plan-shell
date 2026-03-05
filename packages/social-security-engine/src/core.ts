/**
 * Core headless engine for Social Security projections.
 */

export interface SSPersonParams {
	currentAge: number;
	claimingAge: number; // usually between 62 and 70
	annualBenefit: number; // Real dollars
}

export interface IncomeStreamResult {
	id: string;
	name: string;
	annualAmounts: Record<number, number>;
	isGuaranteed: boolean;
	hasCOLA: boolean;
	taxStatus: "taxable" | "tax-free" | "tax-deferred";
}

/**
 * Calculates when benefits will start and generates a projected income stream.
 */
export function calculateSSIncomeStream(
	person: SSPersonParams,
	currentYear: number,
	horizonYears: number = 40,
): { startYear: number; stream: IncomeStreamResult } {
	if (!Number.isFinite(person.currentAge) || person.currentAge < 0) {
		throw new Error("currentAge must be a non-negative number");
	}
	if (!Number.isFinite(person.claimingAge) || person.claimingAge < 62) {
		throw new Error("claimingAge must be at least 62");
	}
	if (person.claimingAge > 70) {
		throw new Error("claimingAge must be 70 or younger");
	}
	if (!Number.isFinite(person.annualBenefit) || person.annualBenefit < 0) {
		throw new Error("annualBenefit must be a non-negative number");
	}
	if (!Number.isFinite(horizonYears) || horizonYears <= 0) {
		throw new Error("horizonYears must be greater than 0");
	}

	const yearsUntilClaim = Math.max(0, person.claimingAge - person.currentAge);
	const startYear = currentYear + yearsUntilClaim;
	const annualAmounts: Record<number, number> = {};

	for (let i = 0; i < horizonYears; i++) {
		const year = currentYear + i;
		if (year >= startYear) {
			annualAmounts[year] = person.annualBenefit;
		} else {
			annualAmounts[year] = 0;
		}
	}

	return {
		startYear,
		stream: {
			id: "social-security",
			name: "Social Security",
			annualAmounts,
			isGuaranteed: true,
			hasCOLA: true, // SS is indexed to inflation
			taxStatus: "taxable", // Mostly taxable depending on bracket
		},
	};
}
