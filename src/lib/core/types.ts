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

export interface FinancialModule<TState = any, TCalc = any, TPublic = any> {
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
		calculate: (params: any) => TCalc;
		project?: (state: TState) => ProjectionData;
		getIncomeStreams?: (state: TState) => IncomeStream[];
	};
	ui: {
		Icon: any;
		Config: any;
		Dashboard: any;
		Analysis: any;
		Import?: any;
	};
}
