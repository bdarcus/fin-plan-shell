
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const MANPATH: string;
	export const EXA_LI_OPTIONS: string;
	export const GHOSTTY_RESOURCES_DIR: string;
	export const TERM_PROGRAM: string;
	export const NODE: string;
	export const EXA_LL_OPTIONS: string;
	export const TERM: string;
	export const SHELL: string;
	export const __FISH_EXA_EXPANDED: string;
	export const EXA_LAAI_OPTIONS: string;
	export const ENHANCD_ARG_HOME: string;
	export const TMPDIR: string;
	export const TERM_PROGRAM_VERSION: string;
	export const EXA_LAAD_OPTIONS: string;
	export const _tide_color_separator_same_color: string;
	export const EXA_LT_OPTIONS: string;
	export const EXA_LE_OPTIONS: string;
	export const __FISH_EXA_OPT_NAMES: string;
	export const npm_config_local_prefix: string;
	export const PNPM_HOME: string;
	export const GIT_EDITOR: string;
	export const EXA_LID_OPTIONS: string;
	export const USER: string;
	export const ENHANCD_USE_ABBREV: string;
	export const ENHANCD_ENABLE_HYPHEN: string;
	export const LS_COLORS: string;
	export const EXA_LC_OPTIONS: string;
	export const COMMAND_MODE: string;
	export const MANROFFOPT: string;
	export const SSH_AUTH_SOCK: string;
	export const ENHANCD_ROOT: string;
	export const __CF_USER_TEXT_ENCODING: string;
	export const npm_execpath: string;
	export const DENO_INSTALL: string;
	export const EXA_LA_OPTIONS: string;
	export const __FISH_EXA_EXPANDED_OPT_NAME: string;
	export const ENHANCD_ENABLE_DOUBLE_DOT: string;
	export const __FISH_EXA_BASE_ALIASES: string;
	export const __FISH_EXA_BINARY: string;
	export const EXA_LD_OPTIONS: string;
	export const __FISH_EXA_ALIASES: string;
	export const PATH: string;
	export const npm_package_json: string;
	export const LaunchInstanceID: string;
	export const GHOSTTY_SHELL_FEATURES: string;
	export const __FISH_EXA_SORT_OPTIONS: string;
	export const ENHANCD_DIR: string;
	export const EXA_LO_OPTIONS: string;
	export const __CFBundleIdentifier: string;
	export const npm_command: string;
	export const PWD: string;
	export const EXA_LAID_OPTIONS: string;
	export const ENHANCD_ENABLE_SINGLE_DOT: string;
	export const npm_lifecycle_event: string;
	export const EDITOR: string;
	export const npm_package_name: string;
	export const EXA_LAI_OPTIONS: string;
	export const LANG: string;
	export const XPC_FLAGS: string;
	export const ENHANCD_ARG_HYPHEN: string;
	export const EXA_L_OPTIONS: string;
	export const npm_package_version: string;
	export const ENHANCD_HYPHEN_NUM: string;
	export const ENHANCD_ENABLE_HOME: string;
	export const XPC_SERVICE_NAME: string;
	export const GPG_TTY: string;
	export const ENHANCD_COMMAND: string;
	export const MANPAGER: string;
	export const HOME: string;
	export const SHLVL: string;
	export const XDG_CONFIG_HOME: string;
	export const TERMINFO: string;
	export const ENHANCD_FILTER: string;
	export const ENHANCD_ARG_DOUBLE_DOT: string;
	export const EXA_LAAID_OPTIONS: string;
	export const LOGNAME: string;
	export const npm_lifecycle_script: string;
	export const XDG_DATA_DIRS: string;
	export const ENHANCD_COMPLETION_KEYBIND: string;
	export const ENHANCD_COMPLETION_DEFAULT: string;
	export const GHOSTTY_BIN_DIR: string;
	export const EXA_LG_OPTIONS: string;
	export const npm_config_user_agent: string;
	export const ENHANCD_ARG_SINGLE_DOT: string;
	export const FNM_HOME: string;
	export const ENHANCD_COMPLETION_BEHAVIOR: string;
	export const EXA_LAD_OPTIONS: string;
	export const EXA_STANDARD_OPTIONS: string;
	export const OSLogRateLimit: string;
	export const EXA_LAA_OPTIONS: string;
	export const SECURITYSESSIONID: string;
	export const npm_node_execpath: string;
	export const _ENHANCD_VERSION: string;
	export const _tide_location_color: string;
	export const COLORTERM: string;
	export const _: string;
	export const NODE_ENV: string;
	export const PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		MANPATH: string;
		EXA_LI_OPTIONS: string;
		GHOSTTY_RESOURCES_DIR: string;
		TERM_PROGRAM: string;
		NODE: string;
		EXA_LL_OPTIONS: string;
		TERM: string;
		SHELL: string;
		__FISH_EXA_EXPANDED: string;
		EXA_LAAI_OPTIONS: string;
		ENHANCD_ARG_HOME: string;
		TMPDIR: string;
		TERM_PROGRAM_VERSION: string;
		EXA_LAAD_OPTIONS: string;
		_tide_color_separator_same_color: string;
		EXA_LT_OPTIONS: string;
		EXA_LE_OPTIONS: string;
		__FISH_EXA_OPT_NAMES: string;
		npm_config_local_prefix: string;
		PNPM_HOME: string;
		GIT_EDITOR: string;
		EXA_LID_OPTIONS: string;
		USER: string;
		ENHANCD_USE_ABBREV: string;
		ENHANCD_ENABLE_HYPHEN: string;
		LS_COLORS: string;
		EXA_LC_OPTIONS: string;
		COMMAND_MODE: string;
		MANROFFOPT: string;
		SSH_AUTH_SOCK: string;
		ENHANCD_ROOT: string;
		__CF_USER_TEXT_ENCODING: string;
		npm_execpath: string;
		DENO_INSTALL: string;
		EXA_LA_OPTIONS: string;
		__FISH_EXA_EXPANDED_OPT_NAME: string;
		ENHANCD_ENABLE_DOUBLE_DOT: string;
		__FISH_EXA_BASE_ALIASES: string;
		__FISH_EXA_BINARY: string;
		EXA_LD_OPTIONS: string;
		__FISH_EXA_ALIASES: string;
		PATH: string;
		npm_package_json: string;
		LaunchInstanceID: string;
		GHOSTTY_SHELL_FEATURES: string;
		__FISH_EXA_SORT_OPTIONS: string;
		ENHANCD_DIR: string;
		EXA_LO_OPTIONS: string;
		__CFBundleIdentifier: string;
		npm_command: string;
		PWD: string;
		EXA_LAID_OPTIONS: string;
		ENHANCD_ENABLE_SINGLE_DOT: string;
		npm_lifecycle_event: string;
		EDITOR: string;
		npm_package_name: string;
		EXA_LAI_OPTIONS: string;
		LANG: string;
		XPC_FLAGS: string;
		ENHANCD_ARG_HYPHEN: string;
		EXA_L_OPTIONS: string;
		npm_package_version: string;
		ENHANCD_HYPHEN_NUM: string;
		ENHANCD_ENABLE_HOME: string;
		XPC_SERVICE_NAME: string;
		GPG_TTY: string;
		ENHANCD_COMMAND: string;
		MANPAGER: string;
		HOME: string;
		SHLVL: string;
		XDG_CONFIG_HOME: string;
		TERMINFO: string;
		ENHANCD_FILTER: string;
		ENHANCD_ARG_DOUBLE_DOT: string;
		EXA_LAAID_OPTIONS: string;
		LOGNAME: string;
		npm_lifecycle_script: string;
		XDG_DATA_DIRS: string;
		ENHANCD_COMPLETION_KEYBIND: string;
		ENHANCD_COMPLETION_DEFAULT: string;
		GHOSTTY_BIN_DIR: string;
		EXA_LG_OPTIONS: string;
		npm_config_user_agent: string;
		ENHANCD_ARG_SINGLE_DOT: string;
		FNM_HOME: string;
		ENHANCD_COMPLETION_BEHAVIOR: string;
		EXA_LAD_OPTIONS: string;
		EXA_STANDARD_OPTIONS: string;
		OSLogRateLimit: string;
		EXA_LAA_OPTIONS: string;
		SECURITYSESSIONID: string;
		npm_node_execpath: string;
		_ENHANCD_VERSION: string;
		_tide_location_color: string;
		COLORTERM: string;
		_: string;
		NODE_ENV: string;
		PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
