import fs from "node:fs/promises";
import { Notice, Plugin, TFile } from "obsidian";
import { ExportPost } from "./application/export-post";
import { DEFAULT_SETTINGS, EXPORT_ICON } from "./config/defaults";
import { errorMessage } from "./core/errors";
import { validateSettingsShape } from "./core/settings-validation";
import type { JekyllExportSettings } from "./domain/types";
import { ObsidianSourceNote } from "./infrastructure/obsidian-source-note";
import { OpenAiTagService } from "./infrastructure/openai-tag-service";
import { PostFileRepository } from "./infrastructure/post-file-repository";
import { VaultAssetPublisher } from "./infrastructure/vault-asset-publisher";
import { createDeviceId } from "./settings/device-id";
import { SettingsStore } from "./settings/settings-store";
import { JekyllExportSettingTab, type SettingsHost } from "./ui/settings-tab";
import { OverwriteModal } from "./ui/overwrite-modal";

export default class JekyllExportPlugin extends Plugin implements SettingsHost {
	override settings: JekyllExportSettings = {
		...DEFAULT_SETTINGS,
		targetFolders: [],
	};
	private settingsStore!: SettingsStore;
	private readonly activeExports = new Set<string>();

	override async onload(): Promise<void> {
		this.settingsStore = new SettingsStore(this, this.app, createDeviceId());
		this.settings = await this.settingsStore.load();

		this.addRibbonIcon(EXPORT_ICON, "Jekyll로 발행", () => {
			const file = this.app.workspace.getActiveFile();
			if (!file || file.extension !== "md") {
				new Notice("열려 있는 마크다운 파일이 없습니다.");
				return;
			}
			void this.exportFile(file);
		});

		this.addCommand({
			id: "export-current-note",
			name: "현재 노트를 Jekyll로 발행",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const available = file?.extension === "md";
				if (available && !checking && file) void this.exportFile(file);
				return available;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				menu.addItem((item) =>
					item
						.setTitle("Jekyll로 발행")
						.setIcon(EXPORT_ICON)
						.onClick(() => void this.exportFile(file)),
				);
			}),
		);

		this.addSettingTab(new JekyllExportSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.settingsStore.save(this.settings);
	}

	async testOpenAiConnection(): Promise<void> {
		const service = new OpenAiTagService(
			this.settings.openaiApiBaseUrl,
			this.settings.openaiModel,
			this.settingsStore.getOpenAiApiKey(this.settings),
		);
		await service.testConnection();
	}

	private async exportFile(file: TFile): Promise<void> {
		if (this.activeExports.has(file.path)) {
			new Notice("이 노트는 이미 발행 중입니다.");
			return;
		}

		this.activeExports.add(file.path);
		try {
			await this.assertSettingsReady();
			const apiKey = this.settingsStore.getOpenAiApiKey(this.settings);
			const tagService = this.settings.useAutoTags
				? new OpenAiTagService(this.settings.openaiApiBaseUrl, this.settings.openaiModel, apiKey)
				: undefined;

			const exporter = new ExportPost({
				posts: new PostFileRepository(),
				overwrite: new OverwriteModal(this.app),
				createAssets: (targetRoot) =>
					new VaultAssetPublisher(this.app, file, targetRoot, this.settings.imageFolder),
				...(tagService ? { tags: tagService } : {}),
			});

			new Notice("Jekyll 발행을 시작합니다.");
			const result = await exporter.execute(new ObsidianSourceNote(this.app, file), this.settings);

			if (result.status === "cancelled") {
				new Notice("발행을 취소했습니다.");
				return;
			}

			for (const warning of result.warnings) new Notice(warning, 8000);
			new Notice(result.status === "created" ? "새 글을 발행했습니다." : "발행된 글을 업데이트했습니다.");
		} catch (error) {
			console.error(`Jekyll export failed: ${errorMessage(error)}`);
			new Notice(`Jekyll 발행 실패: ${errorMessage(error)}`, 10000);
		} finally {
			this.activeExports.delete(file.path);
		}
	}

	private async assertSettingsReady(): Promise<void> {
		const errors = validateSettingsShape(this.settings);
		if (errors.length > 0) throw new Error(errors.join("\n"));

		const stat = await fs.stat(this.settings.activeTargetFolder);
		if (!stat.isDirectory()) throw new Error("활성 대상 폴더가 디렉터리가 아닙니다.");
	}
}
