import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import { planningStore } from "../src/lib/shared/planning";

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

describe("planning store persistence", () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, "localStorage", {
			value: createLocalStorageMock(),
			configurable: true,
		});
	});

	afterEach(() => {
		delete (globalThis as { localStorage?: LocalStorageMock }).localStorage;
		planningStore.set({
			people: [
				{ age: 65, gender: "male" },
				{ age: 65, gender: "female" },
			],
			conservatismMargin: 0.5,
		});
	});

	test("save then load restores values from localStorage", () => {
		const next = {
			people: [
				{ age: 62, gender: "female" as const },
				{ age: 68, gender: "male" as const },
			],
			conservatismMargin: 0.73,
		};

		planningStore.save(next);
		planningStore.set({
			people: [
				{ age: 50, gender: "male" },
				{ age: 50, gender: "female" },
			],
			conservatismMargin: 0.1,
		});
		planningStore.load();

		expect(get(planningStore)).toEqual(next);
	});
});
