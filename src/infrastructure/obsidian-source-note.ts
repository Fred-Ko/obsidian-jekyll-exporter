import type { App, TFile } from "obsidian";
import type { SourceNote } from "../application/export-post";

export class ObsidianSourceNote implements SourceNote {
	readonly name: string;
	readonly path: string;

	constructor(
		private readonly app: App,
		private readonly file: TFile,
	) {
		this.name = file.name;
		this.path = file.path;
	}

	read(): Promise<string> {
		return this.app.vault.read(this.file);
	}

	write(content: string): Promise<void> {
		return this.app.vault.modify(this.file, content);
	}
}
