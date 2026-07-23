import { describe, expect, it } from "vitest";
import { PermalinkStyle } from "../src/domain/types";
import { applyPermalink, reconcileNanoId } from "../src/core/post-metadata";

describe("post metadata", () => {
	it("keeps the published nanoId during a re-export", () => {
		const source = { nanoId: "draft" };
		expect(reconcileNanoId(source, { nanoId: "published" })).toBe("published");
		expect(source.nanoId).toBe("published");
	});

	it("creates each permalink style", () => {
		expect(applyPermalink({ nanoId: "stable" }, PermalinkStyle.NanoId, "post+name.md").permalink).toBe(
			"/stable/",
		);
		expect(applyPermalink({}, PermalinkStyle.FileNameUrlEncoded, "글+제목.md").permalink).toBe(
			"/%EA%B8%80%2B%EC%A0%9C%EB%AA%A9.md/",
		);
		expect(applyPermalink({}, PermalinkStyle.FileNameNoUrlEncoding, "post+name.md").permalink).toBe(
			"/post+name/",
		);
	});

	it("does not alter an existing permalink when disabled", () => {
		const frontMatter = { permalink: "/keep/" };
		expect(applyPermalink(frontMatter, PermalinkStyle.None, "ignored.md")).toEqual(frontMatter);
	});
});
