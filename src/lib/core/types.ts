/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Component } from "svelte";
import type { Readable } from "svelte/store";

export interface ProjectionData {
	years: number[];
	values: number[];
}

export interface IncomeStream {
	id: string;
	name: string;
	annualAmounts: Record<number, number>;
	isGuaranteed: boolean;
	hasCOLA: boolean;
	taxStatus: "taxable" | "tax-free" | "tax-deferred";
}

/**
 * Base interface for modules stored in the global registry.
 * Uses 'any' for component generics to allow heterogeneous modules to coexist.
 */
export interface BaseFinancialModule {
	id: string;
	name: string;
	description: string;
	category: "income" | "portfolio" | "expense";
	store: {
		subscribe: (run: (value: any) => void) => () => void;
		save: (state: any) => void;
		load: () => void;
		reset: () => void;
		publicData?: Readable<unknown>;
	};
	engine: {
		calculate: (params: unknown) => unknown;
		project?: (state: any) => ProjectionData;
		getIncomeStreams?: (state: any) => IncomeStream[];
	};
	ui: {
		Icon: Component<any>;
		Config: Component<any>;
		Dashboard: Component<any>;
		Analysis: Component<any>;
		Import?: Component<any>;
	};
}

/**
 * Type-safe interface for specific module implementations.
 */
export interface FinancialModule<
	TState = unknown,
	TCalc = unknown,
	TPublic = unknown,
> extends BaseFinancialModule {
	store: BaseFinancialModule["store"] & {
		subscribe: (run: (value: TState) => void) => () => void;
		save: (state: TState) => void;
		publicData?: Readable<TPublic>;
	};
	engine: {
		calculate: (params: unknown) => TCalc;
		project?: (state: TState) => ProjectionData;
		getIncomeStreams?: (state: TState) => IncomeStream[];
	};
}
