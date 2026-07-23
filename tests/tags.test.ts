import { describe, expect, it } from "vitest";
import { normalizeTags } from "../src/core/tags";

describe("normalizeTags", () => {
	it("normalizes, deduplicates, and limits tags", () => {
		expect(
			normalizeTags(" TypeScript, API Design, 타입 시스템, TypeScript, one, two, three, four, five, six "),
		).toEqual(["typescript", "api-design", "타입-시스템", "one", "two", "three", "four"]);
	});

	it("returns null when no usable tags remain", () => {
		expect(normalizeTags("!, a, _")).toBeNull();
	});
});
