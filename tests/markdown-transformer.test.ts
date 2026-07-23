import { describe, expect, it } from "vitest";
import type { AssetPublisher } from "../src/core/markdown-transformer";
import { transformMarkdown } from "../src/core/markdown-transformer";

class FakeAssets implements AssetPublisher {
	readonly requested: string[] = [];

	constructor(private readonly paths: Record<string, string | null> = {}) {}

	async publish(reference: string): Promise<string | null> {
		this.requested.push(reference);
		return this.paths[reference] ?? null;
	}
}

describe("transformMarkdown", () => {
	it("converts wiki links while preserving labels and anchors", async () => {
		const output = await transformMarkdown(
			"[[Domain Design|설계]] 그리고 [[Aggregate#Root]]",
			new FakeAssets(),
		);
		expect(output).toBe("[설계](domain-design) 그리고 [Aggregate#Root](aggregate#Root)");
	});

	it("publishes internal wiki and Markdown images", async () => {
		const assets = new FakeAssets({
			"Diagram.png": "assets/images/diagram.png",
			"images/Flow.png": "assets/images/flow.png",
		});
		const output = await transformMarkdown(
			'![[Diagram.png|320]]\n![flow](images/Flow.png){:width="400px"}',
			assets,
		);
		expect(output).toBe(
			'![](assets/images/diagram.png){:width="320px"}\n' + '![flow](assets/images/flow.png){:width="400px"}',
		);
		expect(assets.requested).toEqual(["Diagram.png", "images/Flow.png"]);
	});

	it("leaves external and unresolved images intact", async () => {
		const output = await transformMarkdown(
			"![[https://example.com/a.png|200]]\n![[missing.png]]",
			new FakeAssets(),
		);
		expect(output).toBe('![](https://example.com/a.png){:width="200px"}\n![[missing.png]]');
	});

	it("never transforms fenced or inline code", async () => {
		const input = "Before [[Page]]\n```md\n[[Code]]\n![[code.png]]\n```\n`[[Inline]]`\n";
		const output = await transformMarkdown(input, new FakeAssets());
		expect(output).toBe("Before [Page](page)\n```md\n[[Code]]\n![[code.png]]\n```\n`[[Inline]]`\n");
	});

	it("preserves leading, trailing, and blank lines", async () => {
		expect(await transformMarkdown("\nBody\n\n", new FakeAssets())).toBe("\nBody\n\n");
	});
});
