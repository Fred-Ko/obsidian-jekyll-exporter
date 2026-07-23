import fs from "node:fs/promises";
import path from "node:path";
import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { AssetPublisher } from "../core/markdown-transformer";
import { ExportError, errorMessage } from "../core/errors";
import { sanitizeAssetFileName } from "../core/file-names";

export class VaultAssetPublisher implements AssetPublisher {
	private readonly cache = new Map<string, string | null>();
	private outputDirectoryCreated = false;

	constructor(
		private readonly app: App,
		private readonly sourceFile: TFile,
		private readonly targetRoot: string,
		private readonly imageFolder: string,
	) {}

	async publish(reference: string): Promise<string | null> {
		const cacheKey = reference.toLowerCase();
		if (this.cache.has(cacheKey)) return this.cache.get(cacheKey) ?? null;

		const result = await this.copyAsset(reference);
		this.cache.set(cacheKey, result);
		return result;
	}

	private async copyAsset(reference: string): Promise<string | null> {
		const cleanedReference = reference.replace(/^<|>$/g, "").split(/[?#]/, 1)[0]?.trim() ?? "";
		const source = this.resolveSource(cleanedReference);
		if (!source) return null;

		const fileName = sanitizeAssetFileName(source.name);
		if (!fileName) throw new ExportError(`이미지 파일명을 안전하게 변환할 수 없습니다: ${source.name}`);

		const root = path.resolve(this.targetRoot);
		const outputDirectory = path.resolve(root, this.imageFolder);
		assertWithinRoot(root, outputDirectory);

		if (!this.outputDirectoryCreated) {
			await fs.mkdir(outputDirectory, { recursive: true });
			this.outputDirectoryCreated = true;
		}

		const destination = path.resolve(outputDirectory, fileName);
		assertWithinRoot(outputDirectory, destination);

		try {
			const bytes = await this.app.vault.readBinary(source);
			await fs.writeFile(destination, Buffer.from(bytes));
		} catch (error) {
			throw new ExportError(`이미지를 복사하지 못했습니다: ${source.path} (${errorMessage(error)})`, error);
		}

		return path.posix.join(this.imageFolder.replaceAll("\\", "/"), fileName);
	}

	private resolveSource(reference: string): TFile | null {
		const linked = this.app.metadataCache.getFirstLinkpathDest(reference, this.sourceFile.path);
		if (linked instanceof TFile) return linked;

		const normalized = reference.replaceAll("\\", "/").toLowerCase();
		const baseName = path.posix.basename(normalized);
		return (
			this.app.vault
				.getFiles()
				.find((file) => file.path.toLowerCase() === normalized || file.name.toLowerCase() === baseName) ??
			null
		);
	}
}

function assertWithinRoot(root: string, candidate: string): void {
	if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
		throw new ExportError(`대상 경로가 허용된 루트를 벗어났습니다: ${candidate}`);
	}
}
