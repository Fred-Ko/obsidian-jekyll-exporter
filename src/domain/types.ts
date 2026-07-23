export enum PermalinkStyle {
	None = "none",
	NanoId = "nanoId",
	FileNameUrlEncoded = "file name (url encoded)",
	FileNameNoUrlEncoding = "file name (no url encoding)",
}

export enum OverwriteChoice {
	Full = "full",
	ContentOnly = "content-only",
	FrontMatterOnly = "front-matter-only",
	Cancel = "cancel",
}

export type FrontMatter = Record<string, unknown>;

export interface ParsedMarkdown {
	frontMatter: FrontMatter;
	body: string;
}

export interface JekyllExportSettings {
	targetFolders: string[];
	frontMatterTemplate: string;
	imageFolder: string;
	activeTargetFolder: string;
	openaiApiBaseUrl: string;
	openaiModel: string;
	openaiSecretName: string;
	useAutoTags: boolean;
	permalinkStyle: PermalinkStyle;
}

export interface ExportResult {
	status: "created" | "updated" | "cancelled";
	targetPath?: string;
	warnings: string[];
}

export interface ExistingPost {
	path: string;
	document: ParsedMarkdown;
}
