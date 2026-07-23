import path from "node:path";
import type { AssetPublisher } from "../core/markdown-transformer";
import { transformMarkdown } from "../core/markdown-transformer";
import { errorMessage } from "../core/errors";
import { resolveExportDirectory } from "../core/export-path";
import { toDatedPostFileName, toPostFileName } from "../core/file-names";
import { applyFrontMatterTemplate, parseMarkdown, stringifyMarkdown } from "../core/front-matter";
import { reconcilePostId } from "../core/post-identity";
import { applyPermalink, reconcileNanoId } from "../core/post-metadata";
import type { ExistingPost, ExportResult, JekyllExportSettings, ParsedMarkdown } from "../domain/types";
import { OverwriteChoice } from "../domain/types";

export interface SourceNote {
	name: string;
	path: string;
	read(): Promise<string>;
	write(content: string): Promise<void>;
}

export interface PostRepository {
	ensureDirectory(directory: string): Promise<void>;
	findPublishedPost(directory: string, postFileName: string): Promise<string | null>;
	read(filePath: string): Promise<string>;
	writeAtomic(filePath: string, content: string): Promise<void>;
	remove(filePath: string): Promise<void>;
}

export interface OverwritePrompter {
	choose(): Promise<OverwriteChoice>;
}

export interface TagService {
	extract(content: string): Promise<string[] | null>;
}

export interface ExportPostDependencies {
	posts: PostRepository;
	overwrite: OverwritePrompter;
	createAssets(targetRoot: string): AssetPublisher;
	tags?: TagService;
	now?: () => Date;
}

export class ExportPost {
	constructor(private readonly dependencies: ExportPostDependencies) {}

	async execute(note: SourceNote, settings: JekyllExportSettings): Promise<ExportResult> {
		const now = this.dependencies.now?.() ?? new Date();
		const warnings: string[] = [];
		const source = parseMarkdown(await note.read());
		const postFileName = toPostFileName(note.name);
		const exportDirectory = resolveExportDirectory(settings.activeTargetFolder, note.path);

		await this.dependencies.posts.ensureDirectory(exportDirectory);
		const existing = await this.loadExistingPost(exportDirectory, postFileName);
		const choice = existing ? await this.dependencies.overwrite.choose() : OverwriteChoice.Full;
		if (choice === OverwriteChoice.Cancel) return { status: "cancelled", warnings };

		const sourceFrontMatter = { ...source.frontMatter };
		const existingFrontMatter = existing?.document.frontMatter;
		const postId = reconcilePostId(sourceFrontMatter, existingFrontMatter);
		const nanoId = reconcileNanoId(sourceFrontMatter, existingFrontMatter);

		let targetFrontMatter =
			choice === OverwriteChoice.ContentOnly && existingFrontMatter
				? { ...existingFrontMatter, post_id: postId, nanoId }
				: sourceFrontMatter;

		const contentChanges = choice === OverwriteChoice.Full || choice === OverwriteChoice.ContentOnly;
		const targetBody = contentChanges
			? await transformMarkdown(source.body, this.dependencies.createAssets(settings.activeTargetFolder))
			: (existing?.document.body ?? source.body);

		if (choice === OverwriteChoice.Full && settings.useAutoTags && this.dependencies.tags) {
			try {
				const tags = await this.dependencies.tags.extract(source.body);
				if (tags) targetFrontMatter.tags = tags;
			} catch (error) {
				warnings.push(`자동 태그 생성을 건너뛰었습니다: ${errorMessage(error)}`);
			}
		}

		targetFrontMatter = applyFrontMatterTemplate(
			settings.frontMatterTemplate,
			targetFrontMatter,
			note.name.replace(/\.md$/i, ""),
			now,
		);
		applyPermalink(targetFrontMatter, settings.permalinkStyle, postFileName);

		const targetPath =
			existing && choice !== OverwriteChoice.Full
				? existing.path
				: path.join(exportDirectory, toDatedPostFileName(postFileName, now.toISOString().slice(0, 10)));

		await this.dependencies.posts.writeAtomic(targetPath, stringifyMarkdown(targetFrontMatter, targetBody));
		await note.write(stringifyMarkdown(targetFrontMatter, source.body));

		if (existing && existing.path !== targetPath) {
			await this.dependencies.posts.remove(existing.path);
		}

		return {
			status: existing ? "updated" : "created",
			targetPath,
			warnings,
		};
	}

	private async loadExistingPost(directory: string, postFileName: string): Promise<ExistingPost | null> {
		const existingPath = await this.dependencies.posts.findPublishedPost(directory, postFileName);
		if (!existingPath) return null;

		const document: ParsedMarkdown = parseMarkdown(await this.dependencies.posts.read(existingPath));
		return { path: existingPath, document };
	}
}
