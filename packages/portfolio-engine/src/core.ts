/**
 * Calculates the constant real amortization amount for a given portfolio balance,
 * expected real rate of return, time horizon, and a future bequest target.
 *
 * This uses the standard annuity formula (Ordinary Annuity):
 * PMT = (P - B * (1+r)^-n) * r / (1 - (1+r)^-n)
 */
export function calculateConstantAmortization(
	balance: number,
	realRate: number,
	yearsRemaining: number,
	bequest: number = 0,
): number {
	if (yearsRemaining <= 0) return Math.max(0, balance - bequest);

	if (realRate === 0) return Math.max(0, (balance - bequest) / yearsRemaining);

    // Standard PV of Future Value (Bequest)
	const pvBequest = bequest * (1 + realRate) ** -yearsRemaining;
	const amortizableBalance = balance - pvBequest;

	// PMT = (P_amort * r) / (1 - (1+r)^-n)
	return Math.max(
		0,
		(amortizableBalance * realRate) / (1 - (1 + realRate) ** -yearsRemaining),
	);
}

/**
 * Projects the portfolio balance into the future.
 * Standard LDI approach: Growth is applied first, then withdrawal occurs at year-end.
 */
export function projectPortfolio(
	balance: number,
	realRate: number,
	horizon: number,
	incomePerYear: number,
): number[] {
	const projection: number[] = [balance];
	let currentBalance = balance;
	for (let i = 0; i < horizon; i++) {
		// Standard order: Growth -> Withdrawal
		currentBalance = (currentBalance * (1 + realRate)) - incomePerYear;
		projection.push(Math.max(0, currentBalance));
	}
	return projection;
}
