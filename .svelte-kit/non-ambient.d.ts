
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/design" | "/import" | "/resources" | "/track";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/design": Record<string, never>;
			"/import": Record<string, never>;
			"/resources": Record<string, never>;
			"/track": Record<string, never>
		};
		Pathname(): "/" | "/design" | "/import" | "/resources" | "/track";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/data/MarketAssumptions.json" | "/data/RefCPI.csv" | "/data/TipsRef.csv" | "/data/TipsYields.csv" | string & {};
	}
}