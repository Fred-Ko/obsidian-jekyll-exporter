import { describe, expect, it } from "vitest";
import {
	isMatchingPublishedPost,
	sanitizeAssetFileName,
	toDatedPostFileName,
	toPostFileName,
	wikiLinkToHref,
} from "../src/core/file-names";

describe("post file names", () => {
	it("keeps the existing plus-separated Jekyll convention", () => {
		expect(toPostFileName("Kotlin When-Expression.md")).toBe("kotlin+when+expression.md");
	});

	it("adds an ISO date", () => {
		expect(toDatedPostFileName("hello.md", "2026-07-23")).toBe("2026-07-23-hello.md");
	});

	it("matches only an exact dated post name", () => {
		expect(isMatchingPublishedPost("2026-07-23-hello.md", "hello.md")).toBe(true);
		expect(isMatchingPublishedPost("2026-07-23-my-hello.md", "hello.md")).toBe(false);
		expect(isMatchingPublishedPost("hello.md.bak", "hello.md")).toBe(false);
	});
});

describe("asset and wiki names", () => {
	it("drops traversal segments from asset references", () => {
		expect(sanitizeAssetFileName("../../Images/My Diagram.png")).toBe("my-diagram.png");
	});

	it("preserves Korean characters", () => {
		expect(sanitizeAssetFileName("설계 다이어그램.png")).toBe("설계-다이어그램.png");
	});

	it("creates a safe wiki href with an anchor", () => {
		expect(wikiLinkToHref("Domain Design#Aggregate Root")).toBe("domain-design#Aggregate%20Root");
	});
});
