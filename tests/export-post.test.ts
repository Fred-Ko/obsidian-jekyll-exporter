import { describe, expect, it } from "vitest";
import { ExportPost, type PostRepository, type SourceNote } from "../src/application/export-post";
import { DEFAULT_SETTINGS } from "../src/config/defaults";
import { parseMarkdown } from "../src/core/front-matter";
import { OverwriteChoice } from "../src/domain/types";

const EXISTING_ID = "836c2a09-9c9b-56b4-a6cb-a7d0d9e4c001";

class FakeNote implements SourceNote {
	written = "";

	constructor(
		readonly name: string,
		readonly path: string,
		private readonly content: string,
	) {}

	async read(): Promise<string> {
		return this.content;
	}

	async write(content: string): Promise<void> {
		this.written = content;
	}
}

class FakePosts implements PostRepository {
	readonly writes = new Map<string, string>();
	readonly removed: string[] = [];
	readonly directories: string[] = [];

	constructor(
		private readonly existingPath: string | null = null,
		private readonly existingContent = "",
	) {}

	async ensureDirectory(directory: string): Promise<void> {
		this.directories.push(directory);
	}

	async findPublishedPost(): Promise<string | null> {
		return this.existingPath;
	}

	async read(): Promise<string> {
		return this.existingContent;
	}

	async writeAtomic(filePath: string, content: string): Promise<void> {
		this.writes.set(filePath, content);
	}

	async remove(filePath: string): Promise<void> {
		this.removed.push(filePath);
	}
}

function createExporter(posts: FakePosts, choice = OverwriteChoice.Full) {
	return new ExportPost({
		posts,
		overwrite: { choose: async () => choice },
		createAssets: () => ({ publish: async () => null }),
		now: () => new Date("2026-07-23T12:00:00.000Z"),
	});
}

describe("ExportPost", () => {
	it("creates a deterministic Jekyll path and synchronizes generated metadata", async () => {
		const posts = new FakePosts();
		const note = new FakeNote(
			"GraphQL Design.md",
			"블로그/Graphql/GraphQL Design.md",
			"---\ntitle: GraphQL Design\n---\nBody [[Link]]\n",
		);

		const result = await createExporter(posts).execute(note, {
			...DEFAULT_SETTINGS,
			activeTargetFolder: "/site",
		});

		const targetPath = "/site/블로그/Graphql/_posts/2026-07-23-graphql+design.md";
		expect(result).toMatchObject({ status: "created", targetPath });
		expect(posts.directories).toEqual(["/site/블로그/Graphql/_posts"]);

		const target = parseMarkdown(posts.writes.get(targetPath) ?? "");
		const source = parseMarkdown(note.written);
		expect(target.body).toBe("Body [Link](link)\n");
		expect(target.frontMatter.post_id).toMatch(/^[0-9a-f-]{36}$/);
		expect(source.frontMatter.post_id).toBe(target.frontMatter.post_id);
		expect(source.frontMatter.nanoId).toBe(target.frontMatter.nanoId);
		expect(source.body).toBe("Body [[Link]]\n");
	});

	it("keeps published Front Matter when only content is updated", async () => {
		const existingPath = "/site/blog/_posts/2025-01-01-note.md";
		const posts = new FakePosts(
			existingPath,
			`---\ntitle: Published\npost_id: ${EXISTING_ID}\nnanoId: stableNano\ncustom: keep\n---\nOld body`,
		);
		const note = new FakeNote(
			"Note.md",
			"blog/Note.md",
			"---\ntitle: Draft\ncustom: discard\n---\nNew [[Body]]",
		);

		await createExporter(posts, OverwriteChoice.ContentOnly).execute(note, {
			...DEFAULT_SETTINGS,
			activeTargetFolder: "/site",
		});

		const target = parseMarkdown(posts.writes.get(existingPath) ?? "");
		expect(target.frontMatter).toMatchObject({
			title: "Published",
			post_id: EXISTING_ID,
			nanoId: "stableNano",
			custom: "keep",
		});
		expect(target.body).toBe("New [Body](body)");
		expect(parseMarkdown(note.written).frontMatter.title).toBe("Published");
	});

	it("keeps the published body when only Front Matter is updated", async () => {
		const existingPath = "/site/blog/_posts/2025-01-01-note.md";
		const posts = new FakePosts(
			existingPath,
			`---\ntitle: Old\npost_id: ${EXISTING_ID}\nnanoId: stableNano\n---\nPublished body`,
		);
		const note = new FakeNote("Note.md", "blog/Note.md", "---\ntitle: New\n---\nDraft body");

		await createExporter(posts, OverwriteChoice.FrontMatterOnly).execute(note, {
			...DEFAULT_SETTINGS,
			activeTargetFolder: "/site",
		});

		const target = parseMarkdown(posts.writes.get(existingPath) ?? "");
		expect(target.frontMatter.title).toBe("New");
		expect(target.frontMatter.post_id).toBe(EXISTING_ID);
		expect(target.body).toBe("Published body");
		expect(parseMarkdown(note.written).body).toBe("Draft body");
	});

	it("cancels without writing", async () => {
		const posts = new FakePosts("/site/blog/_posts/2025-01-01-note.md", "Body");
		const note = new FakeNote("Note.md", "blog/Note.md", "Draft");
		const result = await createExporter(posts, OverwriteChoice.Cancel).execute(note, {
			...DEFAULT_SETTINGS,
			activeTargetFolder: "/site",
		});
		expect(result.status).toBe("cancelled");
		expect(posts.writes.size).toBe(0);
		expect(note.written).toBe("");
	});

	it("keeps publishing when automatic tags fail and reports a warning", async () => {
		const posts = new FakePosts();
		const exporter = new ExportPost({
			posts,
			overwrite: { choose: async () => OverwriteChoice.Full },
			createAssets: () => ({ publish: async () => null }),
			tags: {
				extract: async () => {
					throw new Error("network unavailable");
				},
			},
			now: () => new Date("2026-07-23T12:00:00.000Z"),
		});

		const result = await exporter.execute(new FakeNote("Note.md", "blog/Note.md", "Body"), {
			...DEFAULT_SETTINGS,
			activeTargetFolder: "/site",
			useAutoTags: true,
		});
		expect(result.status).toBe("created");
		expect(result.warnings).toEqual(["자동 태그 생성을 건너뛰었습니다: network unavailable"]);
	});
});
