import fs from "node:fs/promises";
import path from "node:path";
import { ButtonComponent, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type { App, Plugin, TextComponent } from "obsidian";
import { DEFAULT_FRONT_MATTER_TEMPLATE, OPENAI_MODELS } from "../config/defaults";
import { errorMessage } from "../core/errors";
import { PermalinkStyle, type JekyllExportSettings } from "../domain/types";

export type SettingsHost = Plugin & {
	settings: JekyllExportSettings;
	saveSettings(): Promise<void>;
	testOpenAiConnection(): Promise<void>;
};

export class JekyllExportSettingTab extends PluginSettingTab {
	private newFolderInput?: TextComponent;

	constructor(
		app: App,
		private readonly host: SettingsHost,
	) {
		super(app, host);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("jekyll-settings");
		containerEl.createEl("h1", { text: "Jekyll Exporter" });
		containerEl.createEl("p", {
			text: "Obsidian 노트를 안전하고 반복 가능한 Jekyll 포스트로 발행합니다.",
			cls: "setting-item-description",
		});

		this.renderTargetFolders();
		this.renderFrontMatter();
		this.renderImages();
		this.renderOpenAi();
		this.renderPermalink();
	}

	private renderTargetFolders(): void {
		const section = this.createSection("발행 대상");
		const folders = section.createDiv("jekyll-folder-list");

		if (this.host.settings.targetFolders.length === 0) {
			folders.createEl("p", { text: "등록된 대상 폴더가 없습니다.", cls: "setting-item-description" });
		}

		this.host.settings.targetFolders.forEach((folder) => {
			const row = folders.createDiv("jekyll-folder-row");
			row.createEl("code", { text: folder });
			new ButtonComponent(row)
				.setIcon("trash-2")
				.setTooltip("대상 폴더 제거")
				.setWarning()
				.onClick(() => void this.removeFolder(folder));
		});

		new Setting(section)
			.setName("대상 폴더 추가")
			.setDesc("Jekyll 저장소 또는 포스트 출력 루트의 절대 경로")
			.addText((text) => {
				this.newFolderInput = text;
				text.setPlaceholder("/path/to/jekyll/site");
			})
			.addButton((button) =>
				button
					.setButtonText("추가")
					.setCta()
					.onClick(() => void this.addFolder()),
			);

		new Setting(section)
			.setName("활성 대상 폴더")
			.setDesc("이 장치에서 발행할 폴더")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "선택하세요");
				for (const folder of this.host.settings.targetFolders) dropdown.addOption(folder, folder);
				dropdown.setValue(this.host.settings.activeTargetFolder);
				dropdown.onChange(async (value) => {
					this.host.settings.activeTargetFolder = value;
					await this.host.saveSettings();
				});
			});
	}

	private renderFrontMatter(): void {
		const section = this.createSection("Front Matter");
		new Setting(section)
			.setName("템플릿")
			.setDesc("지원 변수: {{title}}, {{date}}, {{datetime}}")
			.addTextArea((text) => {
				text.inputEl.addClass("jekyll-front-matter-template");
				text
					.setPlaceholder(DEFAULT_FRONT_MATTER_TEMPLATE)
					.setValue(this.host.settings.frontMatterTemplate)
					.onChange(async (value) => {
						this.host.settings.frontMatterTemplate = value;
						await this.host.saveSettings();
					});
			});
	}

	private renderImages(): void {
		const section = this.createSection("이미지");
		new Setting(section)
			.setName("이미지 폴더")
			.setDesc("활성 대상 폴더 기준 상대 경로")
			.addText((text) =>
				text
					.setPlaceholder("assets/images")
					.setValue(this.host.settings.imageFolder)
					.onChange(async (value) => {
						this.host.settings.imageFolder = value.trim();
						await this.host.saveSettings();
					}),
			);
	}

	private renderOpenAi(): void {
		const section = this.createSection("자동 태그");

		new Setting(section)
			.setName("자동 태그 생성")
			.setDesc("OpenAI 호환 API로 3~7개의 태그를 생성합니다.")
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.useAutoTags).onChange(async (value) => {
					this.host.settings.useAutoTags = value;
					await this.host.saveSettings();
				}),
			);

		new Setting(section)
			.setName("API Base URL")
			.setDesc("OpenAI 호환 Chat Completions API 주소")
			.addText((text) =>
				text
					.setPlaceholder("https://api.openai.com/v1")
					.setValue(this.host.settings.openaiApiBaseUrl)
					.onChange(async (value) => {
						this.host.settings.openaiApiBaseUrl = value.trim();
						await this.host.saveSettings();
					}),
			);

		let customModelInput: TextComponent | undefined;
		new Setting(section)
			.setName("모델")
			.setDesc("사용할 모델 또는 사용자 정의 모델 이름")
			.addDropdown((dropdown) => {
				const knownModel = OPENAI_MODELS.includes(
					this.host.settings.openaiModel as (typeof OPENAI_MODELS)[number],
				);
				for (const model of OPENAI_MODELS) dropdown.addOption(model, model);
				dropdown.setValue(knownModel ? this.host.settings.openaiModel : "custom");
				dropdown.onChange(async (value) => {
					if (value === "custom") {
						customModelInput?.inputEl.removeClass("jekyll-is-hidden");
						return;
					}
					customModelInput?.inputEl.addClass("jekyll-is-hidden");
					this.host.settings.openaiModel = value;
					await this.host.saveSettings();
				});
			})
			.addText((text) => {
				customModelInput = text;
				const isCustom = !OPENAI_MODELS.includes(
					this.host.settings.openaiModel as (typeof OPENAI_MODELS)[number],
				);
				text
					.setPlaceholder("사용자 정의 모델")
					.setValue(isCustom ? this.host.settings.openaiModel : "")
					.onChange(async (value) => {
						if (!value.trim()) return;
						this.host.settings.openaiModel = value.trim();
						await this.host.saveSettings();
					});
				if (!isCustom) text.inputEl.addClass("jekyll-is-hidden");
			});

		new Setting(section)
			.setName("API Secret")
			.setDesc("Obsidian SecretStorage에 저장되며 data.json에는 값이 기록되지 않습니다.")
			.addComponent((element) =>
				new SecretComponent(this.app, element)
					.setValue(this.host.settings.openaiSecretName)
					.onChange(async (secretName) => {
						this.host.settings.openaiSecretName = secretName?.trim() ?? "";
						await this.host.saveSettings();
					}),
			);

		new Setting(section)
			.setName("연결 확인")
			.setDesc("현재 API 주소, 모델, Secret 조합을 검증합니다.")
			.addButton((button) =>
				button.setButtonText("테스트").onClick(async () => {
					button.setDisabled(true);
					try {
						await this.host.testOpenAiConnection();
						new Notice("API 연결에 성공했습니다.");
					} catch (error) {
						new Notice(`API 연결 실패: ${errorMessage(error)}`);
					} finally {
						button.setDisabled(false);
					}
				}),
			);
	}

	private renderPermalink(): void {
		const section = this.createSection("Permalink");
		new Setting(section)
			.setName("생성 방식")
			.setDesc("이 장치에서 Front Matter에 기록할 permalink 방식")
			.addDropdown((dropdown) => {
				dropdown.addOption(PermalinkStyle.None, "변경하지 않음");
				dropdown.addOption(PermalinkStyle.NanoId, "Nano ID");
				dropdown.addOption(PermalinkStyle.FileNameUrlEncoded, "파일명 (URL 인코딩)");
				dropdown.addOption(PermalinkStyle.FileNameNoUrlEncoding, "파일명 (인코딩 없음)");
				dropdown.setValue(this.host.settings.permalinkStyle);
				dropdown.onChange(async (value) => {
					this.host.settings.permalinkStyle = value as PermalinkStyle;
					await this.host.saveSettings();
				});
			});
	}

	private createSection(title: string): HTMLElement {
		const section = this.containerEl.createDiv("jekyll-settings-section");
		section.createEl("h2", { text: title });
		return section;
	}

	private async addFolder(): Promise<void> {
		const raw = this.newFolderInput?.getValue().trim() ?? "";
		if (!raw) {
			new Notice("대상 폴더를 입력해 주세요.");
			return;
		}

		const folder = path.resolve(raw);
		try {
			const stat = await fs.stat(folder);
			if (!stat.isDirectory()) throw new Error("디렉터리가 아닙니다.");
		} catch (error) {
			new Notice(`유효한 대상 폴더가 아닙니다: ${errorMessage(error)}`);
			return;
		}

		if (this.host.settings.targetFolders.includes(folder)) {
			new Notice("이미 등록된 대상 폴더입니다.");
			return;
		}

		this.host.settings.targetFolders.push(folder);
		if (!this.host.settings.activeTargetFolder) this.host.settings.activeTargetFolder = folder;
		await this.host.saveSettings();
		this.display();
	}

	private async removeFolder(folder: string): Promise<void> {
		this.host.settings.targetFolders = this.host.settings.targetFolders.filter(
			(candidate) => candidate !== folder,
		);
		if (this.host.settings.activeTargetFolder === folder) {
			this.host.settings.activeTargetFolder = this.host.settings.targetFolders[0] ?? "";
		}
		await this.host.saveSettings();
		this.display();
	}
}
