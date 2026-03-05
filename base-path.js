/**
 * Normalize a base path to either "" or "/segment[/subsegment]".
 * Empty, whitespace-only, and "/" normalize to "".
 */
export function normalizeBasePath(value) {
	if (value == null) return "";
	const trimmed = String(value).trim();
	if (!trimmed || trimmed === "/") return "";
	const normalized = trimmed.replace(/^\/+|\/+$/g, "");
	return normalized ? `/${normalized}` : "";
}

/**
 * Resolve base path from env with production/dev fallback defaults.
 * Priority:
 * 1. BASE_PATH env var (normalized)
 * 2. NODE_ENV === "production" -> "/fin-plan-shell"
 * 3. otherwise -> ""
 */
export function resolveBasePath(env = process.env) {
	if (Object.prototype.hasOwnProperty.call(env, "BASE_PATH")) {
		return normalizeBasePath(env.BASE_PATH);
	}
	return env.NODE_ENV === "production" ? "/fin-plan-shell" : "";
}
