import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { validateSettingsShape } from "../src/core/settings-validation";

describe("validateSettingsShape", () => {
	it("accepts a valid configuration", () => {
		expect(
			validateSettingsShape({
				...DEFAULT_SETTINGS,
				activeTargetFolder: "/tmp/blog",
			}),
		).toEqual([]);
	});

	it("rejects traversal and malformed endpoints", () => {
		const errors = validateSettingsShape({
			...DEFAULT_SETTINGS,
			activeTargetFolder: "",
			imageFolder: "../outside",
			openaiApiBaseUrl: "not-a-url",
			openaiModel: "",
		});
		expect(errors).toHaveLength(4);
	});
});
