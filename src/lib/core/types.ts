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

export interface FinancialModule<
	TState = unknown,
	TCalc = unknown,
	TPublic = unknown,
> {
	id: string;
	name: string;
	description: string;
	category: "income" | "portfolio" | "expense";
	store: {
		subscribe: (run: (value: TState) => void) => () => void;
		save: (state: TState) => void;
		load: () => void;
		reset: () => void;
		publicData?: Readable<TPublic>;
	};
	engine: {
		calculate: (params: unknown) => TCalc;
		project?: (state: TState) => ProjectionData;
		getIncomeStreams?: (state: TState) => IncomeStream[];
	};
	ui: {
		// biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic
		Icon: Component<Record<string, any>>;
		// biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic
		Config: Component<Record<string, any>>;
		// biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic
		Dashboard: Component<Record<string, any>>;
		// biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic
		Analysis: Component<Record<string, any>>;
		// biome-ignore lint/suspicious/noExplicitAny: Component props are dynamic
		Import?: Component<Record<string, any>>;
	};
}
