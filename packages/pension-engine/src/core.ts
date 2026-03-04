/**
 * Core headless engine for Pension projections.
 */

export interface PensionParams {
    annualBenefit: number;
    startYear: number;
    hasCOLA: boolean;
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
 * Generates a projected income stream for a defined benefit pension.
 * Note: If COLA is false, the real value of the pension declines over time.
 * For this simple engine, we assume the input benefit is in real dollars at the start year.
 * If there is no COLA, the benefit in real dollars should theoretically be discounted by inflation,
 * but for this simplified model we return the nominal amounts or a linearly discounted real amount.
 * Here we return the flat amount, leaving real-discounting to the Monte Carlo engine if COLA is false.
 */
export function calculatePensionStream(
    pension: PensionParams,
    currentYear: number,
    horizonYears: number = 40
): IncomeStreamResult {
    const annualAmounts: Record<number, number> = {};

    for (let i = 0; i < horizonYears; i++) {
        const year = currentYear + i;
        if (year >= pension.startYear) {
            annualAmounts[year] = pension.annualBenefit;
        } else {
            annualAmounts[year] = 0;
        }
    }

    return {
        id: "pension-main",
        name: "Pension Benefit",
        annualAmounts,
        isGuaranteed: true,
        hasCOLA: pension.hasCOLA,
        taxStatus: "taxable",
    };
}
