import { describe, expect, test } from "bun:test";
import { normalizeBasePath, resolveBasePath } from "../base-path.js";

describe("base path resolver", () => {
	test("normalizes explicit BASE_PATH with leading slash", () => {
		expect(resolveBasePath({ BASE_PATH: "/fin-plan-shell" })).toBe(
			"/fin-plan-shell",
		);
	});

	test("normalizes explicit BASE_PATH without leading slash and with trailing slash", () => {
		expect(resolveBasePath({ BASE_PATH: "fin-plan-shell/" })).toBe(
			"/fin-plan-shell",
		);
	});

	test("normalizes explicit empty BASE_PATH to root", () => {
		expect(resolveBasePath({ BASE_PATH: "" })).toBe("");
	});

	test("defaults to Pages base path in production when BASE_PATH is unset", () => {
		expect(resolveBasePath({ NODE_ENV: "production" })).toBe("/fin-plan-shell");
	});

	test("defaults to root in development when BASE_PATH is unset", () => {
		expect(resolveBasePath({ NODE_ENV: "development" })).toBe("");
	});

	test("normalizeBasePath handles slash-only values", () => {
		expect(normalizeBasePath("/")).toBe("");
		expect(normalizeBasePath("///")).toBe("");
	});
});
