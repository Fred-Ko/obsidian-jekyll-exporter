import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveExportDirectory } from "../src/core/export-path";

describe("resolveExportDirectory", () => {
	it("mirrors the vault directory under the target root", () => {
		expect(resolveExportDirectory("/site", "블로그/Graphql/Post.md")).toBe(
			path.resolve("/site/블로그/Graphql/_posts"),
		);
	});

	it("rejects paths that escape the target root", () => {
		expect(() => resolveExportDirectory("/site", "../../outside/Post.md")).toThrow(
			/대상 루트를 벗어났습니다/,
		);
	});
});
