import { parseArgs } from "util";
import { buildLadder, type BondInfo } from "./core";
import { readFileSync } from "fs";
import { join } from "path";

// A small parser for the existing TipsYields.csv file to test with real data
function loadRealBonds(): BondInfo[] {
    const csvPath = join(process.cwd(), "static/data/TipsYields.csv");
    const content = readFileSync(csvPath, "utf-8");
    const lines = content.trim().split("\n");
    // settlementDate,cusip,maturity,coupon,baseCpi,price,yield
    
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
            yield: parseFloat(cols[6])
        });
    }
    return bonds;
}

function formatCurrency(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

function formatPercent(val: number): string {
    return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 }).format(val);
}

export function generateReport() {
    const { values } = parseArgs({
        args: Bun.argv,
        options: {
            dara: { type: "string", default: "40000" },
            start: { type: "string", default: "2026" },
            end: { type: "string", default: "2055" },
        },
        strict: true,
        allowPositionals: true,
    });

    const dara = parseFloat(values.dara!);
    const startYear = parseInt(values.start!);
    const endYear = parseInt(values.end!);

    console.log(`\n=== TIPS Ladder Generation Report ===`);
    console.log(`Target Annual Real Income (DARA): ${formatCurrency(dara)}`);
    console.log(`Horizon: ${startYear} to ${endYear}`);
    console.log(`-----------------------------------`);

    try {
        const bonds = loadRealBonds();
        const result = buildLadder(bonds, dara, startYear, endYear, new Date("2026-03-01"));

        console.log(`Total Initial Cost: ${formatCurrency(result.totalCost)}`);
        console.log(`\nLadder Rungs:`);
        console.log(`Year | CUSIP     | Qty  | Cost        | Par Value   | Annual Drip`);
        console.log(`-----|-----------|------|-------------|-------------|------------`);
        
        for (const rung of result.rungs) {
            console.log(`${rung.year} | ${rung.cusip.padEnd(9)} | ${rung.qty.toString().padEnd(4)} | ${formatCurrency(rung.cost).padEnd(11)} | ${formatCurrency(rung.principal).padEnd(11)} | ${formatCurrency(rung.couponIncome)}`);
        }

        const gaps = Object.keys(result.unmetIncome);
        if (gaps.length > 0) {
            console.log(`\n[WARNING] Gap Years Detected (No specific maturity found):`);
            for (const year of gaps) {
                console.log(`- ${year}: Shortfall of ${formatCurrency(result.unmetIncome[Number(year)])}`);
            }
            console.log(`\nNote: A full duration-matching implementation interpolates these gaps using surrounding bonds.`);
        }

        console.log(`===================================\n`);
    } catch (e: any) {
        console.error(`Error generating report: ${e.message}`);
    }
}

if (import.meta.main) {
    generateReport();
}
