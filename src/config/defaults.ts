import { PermalinkStyle, type JekyllExportSettings } from "../domain/types";

export const DEFAULT_FRONT_MATTER_TEMPLATE = `---
title: {{title}}
date: {{date}}
---
`;

export const DEFAULT_SETTINGS: JekyllExportSettings = {
	targetFolders: [],
	frontMatterTemplate: DEFAULT_FRONT_MATTER_TEMPLATE,
	imageFolder: "assets/images",
	activeTargetFolder: "",
	openaiApiBaseUrl: "https://api.openai.com/v1",
	openaiModel: "gpt-4o-mini",
	openaiSecretName: "",
	useAutoTags: false,
	permalinkStyle: PermalinkStyle.NanoId,
};

export const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "custom"] as const;

export const PLUGIN_ID = "obsidian-jekyll-exporter";
export const EXPORT_ICON = "upload";
