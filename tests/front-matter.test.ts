import { describe, expect, it } from "vitest";
import { applyFrontMatterTemplate, parseMarkdown, stringifyMarkdown } from "../src/core/front-matter";

describe("Front Matter parsing", () => {
	it("parses CRLF documents without changing the body", () => {
		const parsed = parseMarkdown("---\r\ntitle: Hello\r\n---\r\nBody\r\n");
		expect(parsed.frontMatter).toEqual({ title: "Hello" });
		expect(parsed.body).toBe("Body\r\n");
	});

	it("accepts documents without Front Matter", () => {
		expect(parseMarkdown("Body only")).toEqual({ frontMatter: {}, body: "Body only" });
	});

	it("rejects non-object Front Matter", () => {
		expect(() => parseMarkdown("---\n- invalid\n---\nBody")).toThrow(/최상위 값은 객체/);
	});

	it("round-trips empty content", () => {
		const markdown = stringifyMarkdown({ title: "Empty" }, "");
		expect(parseMarkdown(markdown)).toEqual({ frontMatter: { title: "Empty" }, body: "" });
	});
});

describe("Front Matter templates", () => {
	it("renders known placeholders and removes unresolved placeholders", () => {
		const result = applyFrontMatterTemplate(
			"---\ntitle: {{title}}\ndate: {{date}}\ntags: {{tags}}\n---",
			{},
			"A title: with a colon",
			new Date("2026-07-23T03:04:05.000Z"),
		);
		expect(result).toEqual({
			title: "A title: with a colon",
			date: "2026-07-23",
		});
	});

	it("never overwrites existing metadata", () => {
		const result = applyFrontMatterTemplate(
			"title: {{title}}\ndate: {{date}}",
			{ title: "Original", date: "2024-01-01", custom: true },
			"Generated",
			new Date("2026-07-23T00:00:00.000Z"),
		);
		expect(result).toEqual({ title: "Original", date: "2024-01-01", custom: true });
	});
});
