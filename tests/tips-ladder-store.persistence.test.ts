import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import { ladderStore } from "../src/lib/modules/tips-ladder/store/ladder";

interface LocalStorageMock {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
	removeItem: (key: string) => void;
	clear: () => void;
}

function createLocalStorageMock(): LocalStorageMock {
	const data = new Map<string, string>();
	return {
		getItem: (key) => data.get(key) ?? null,
		setItem: (key, value) => {
			data.set(key, value);
		},
		removeItem: (key) => {
			data.delete(key);
		},
		clear: () => {
			data.clear();
		},
	};
}

describe("tips ladder store persistence", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "localStorage", {
			value: createLocalStorageMock(),
			configurable: true,
		});

		ladderStore.set({
			ladders: [
				{
					id: "ladder-1",
					name: "Retirement Floor",
					type: "simple-income",
					taxStatus: "taxable",
					startYear: 2025,
					endYear: 2030,
					annualIncome: 20000,
				},
			],
		});
	});

	afterEach(() => {
		delete (globalThis as { localStorage?: LocalStorageMock }).localStorage;
		ladderStore.reset();
	});

	test("updating an existing ladder and saving persists the latest values", () => {
		ladderStore.updateLadder("ladder-1", {
			startYear: 2027,
			endYear: 2032,
			annualIncome: 25000,
		});

		ladderStore.save(get(ladderStore));
		ladderStore.set({ ladders: [] });
		ladderStore.load();

		expect(get(ladderStore).ladders).toEqual([
			{
				id: "ladder-1",
				name: "Retirement Floor",
				type: "simple-income",
				taxStatus: "taxable",
				startYear: 2027,
				endYear: 2032,
				annualIncome: 25000,
				positions: [],
				settings: {
					strategy: "Default",
					excludeCusips: [],
				},
			},
		]);
	});
});
