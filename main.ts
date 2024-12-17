import * as fs from "fs/promises";
import { customAlphabet } from "nanoid";
import { App, ButtonComponent, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFile } from "obsidian";
import * as path from "path";
import * as yaml from "yaml";

interface JekyllExportSettings {
	targetFolders: string[];
	excludePatterns: string[];
	frontMatterTemplate: string;
	imageFolder: string;
	attachmentSearchMode: "vault" | "specified" | "same" | "subfolder";
	customAttachmentFolder: string;
	activeTargetFolder: string;
	openaiApiBaseUrl: string;
	openaiModel: string;
	openaiApiKey: string;
	useAutoTags: boolean;
}
const DEFAULT_FRONT_MATTER_TEMPLATE = "---\ntitle: {{title}}\ndate: {{date}}\ntags: {{tags}}\n---\n";

const DEFAULT_SETTINGS: JekyllExportSettings = {
	targetFolders: [],
	excludePatterns: [],
	frontMatterTemplate: DEFAULT_FRONT_MATTER_TEMPLATE,
	imageFolder: "assets/images",
	attachmentSearchMode: "vault",
	customAttachmentFolder: "",
	activeTargetFolder: "",
	openaiApiBaseUrl: "https://api.openai.com/v1",
	openaiModel: "gpt-3.5-turbo",
	openaiApiKey: "",
	useAutoTags: false,
};

const BUTTON_TEXT_OVERWRITE_FRONTMATTER_AND_CONTENT = "Overwrite Date and Content";
const BUTTON_TEXT_OVERWRITE_CONTENT_ONLY = "Overwrite Content Only";
const BUTTON_TEXT_CANCEL = "Cancel";
const MODAL_TITLE = "File Already Exists";
const MODAL_DESCRIPTION = "Please select how to handle the existing file.";
const BUTTON_ADD = "Add";
const BUTTON_DELETE = "Delete";
const BUTTON_EXPORT = "Export to Jekyll";
const ICON_UPLOAD = "upload";

const MODAL_CSS = `
.overwrite-modal-content {
	padding: 20px;
	text-align: center;
}

.overwrite-modal-title {
	margin-bottom: 10px;
	font-size: 1.5em;
	color: var(--text-normal);
}

.overwrite-modal-description {
	margin-bottom: 20px;
	color: var(--text-muted);
}

.overwrite-modal-button-container {
	display: flex;
	flex-direction: column;
	gap: 8px;
	max-width: 300px;
	margin: 0 auto;
}

.button-primary {
	background-color: var(--interactive-accent);
	color: var(--text-on-accent);
	border: none;
	width: 100%;
	padding: 8px 16px;
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.button-primary:hover {
	background-color: var(--interactive-accent-hover);
}

.button-secondary {
	background-color: transparent;
	border: 1px solid var(--interactive-accent);
	color: var(--text-normal);
	width: 100%;
	padding: 8px 16px;
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.button-secondary:hover {
	background-color: var(--background-modifier-hover);
}
`;

const SETTINGS_CSS = `
.jekyll-export-plugin {
    .jekyll-settings-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 16px;
    }

    .jekyll-settings-section {
        background: var(--background-secondary);
        border-radius: 8px;
        padding: 12px 24px;
        margin-bottom: 16px;
    }

    .jekyll-settings-section h2 {
        margin: 0 0 12px 0;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--background-modifier-border);
        color: var(--text-normal);
        font-size: 1.4em;
        font-weight: 600;
    }

    .folders-container {
        background: var(--background-primary);
        border-radius: 6px;
        padding: 8px;
        margin: 8px 0 12px 0;
    }

    .folder-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px !important;
        margin-bottom: 8px !important;
        background: var(--background-secondary);
        border-radius: 4px !important;
        transition: all 0.2s ease;
    }

    .folder-item:hover {
        background: var(--background-modifier-hover);
    }

    .folder-path {
        font-family: var(--font-monospace);
        font-size: 0.9em !important;
        color: var(--text-normal);
        flex: 1;
        margin-right: 16px;
        word-break: break-all;
    }

    .folder-input {
        font-size: 14px !important;
        padding: 8px 12px !important;
        width: 100% !important;
        background: var(--background-primary) !important;
        box-sizing: border-box !important;
    }

    .folder-select {
        width: 100% !important;
        max-width: none !important;
        padding: 8px 12px !important;
        background: var(--background-primary) !important;
        border-radius: 4px !important;
        margin-top: 8px !important;
        box-sizing: border-box !important;
    }

    .front-matter-textarea {
        width: 100% !important;
        min-height: 150px !important;
        font-family: var(--font-monospace) !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
        padding: 12px !important;
        background: var(--background-primary) !important;
        border: 1px solid var(--background-modifier-border) !important;
        border-radius: 6px !important;
        resize: vertical !important;
        box-sizing: border-box !important;
    }

    .setting-item {
        border: none;
        padding: 12px 0;
        width: 100% !important;
        display: flex !important;
        justify-content: space-between !important;
    }

    .setting-item-info {
        margin-bottom: 0 !important;
        flex: 0 1 250px !important;
    }

    .setting-item-name {
        font-size: 1em;
        font-weight: 600;
        margin-bottom: 2px;
    }

    .setting-item-description {
        font-size: 0.85em;
        color: var(--text-muted);
    }

    .setting-item-control {
        width: 350px !important;
        padding-right: 0 !important;
        flex: 0 0 auto !important;
    }

    .setting-item input[type="text"] {
        width: 100% !important;
        font-size: 14px !important;
        padding: 8px 12px !important;
        background: var(--background-primary) !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
    }

    .jekyll-button {
        padding: 4px 12px !important;
        border-radius: 4px !important;
        font-size: 12px !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        background-color: var(--interactive-accent) !important;
        color: var(--text-on-accent) !important;
        min-height: 24px !important;
        line-height: 1 !important;
    }

    .jekyll-button:hover {
        opacity: 0.9;
    }

    .jekyll-button.danger {
        background-color: var(--text-error) !important;
    }

    @media screen and (max-width: 768px) {
        .jekyll-settings-container {
            padding: 16px;
        }

        .jekyll-settings-section {
            padding: 20px;
        }
    }
}
`;

type FrontMatterObject = {
	[key: string]: string | string[];
};

function injectStyles(css: string) {
	const style = document.createElement("style");
	style.innerHTML = css;
	document.head.appendChild(style);
}

function sentinize(fileName: string) {
	return fileName.replace(/ /g, "-");
}

function alphaNumNanoId(): string {
	const alphaNum = "123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	return customAlphabet(alphaNum, 25)();
}

class FrontMatterProcessor {
	private readonly frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\n/;
	private frontMatterProcessor = {
		"{{title}}": (title: string) => title.replace(/\.md$/i, ""),
		"{{date}}": () => new Date().toISOString().split("T")[0],
		"{{datetime}}": () => new Date().toISOString(),
	};

	constructor(private app: App, private settings: JekyllExportSettings) {}

	public async parse(content: string): Promise<{ frontMatter: FrontMatterObject; contentBody: string }> {
		const frontMatterMatch = content.match(this.frontMatterRegex);

		if (frontMatterMatch) {
			try {
				const frontMatter = yaml.parse(frontMatterMatch[1]);
				const contentBody = content.slice(frontMatterMatch[0].length);
				return { frontMatter, contentBody };
			} catch (error) {
				new Notice("Front matter is not valid YAML");
				throw new Error("Front matter is not valid YAML");
			}
		}

		return { frontMatter: {}, contentBody: content };
	}

	public async getFrontMatterFromTemplate(template: string, file: TFile): Promise<FrontMatterObject> {
		const templateWithoutDashes = template.replace(/---/g, "").trim();
		if (templateWithoutDashes === "") {
			return {};
		}

		const frontMatter: FrontMatterObject = {};
		const lines = templateWithoutDashes.split("\n");

		for (const line of lines) {
			const [key, value] = line.split(":").map((part) => part.trim());
			if (key && value) {
				switch (value) {
					case "{{title}}":
						frontMatter[key] = this.frontMatterProcessor[value](file.name);
						break;
					case "{{date}}":
						frontMatter[key] = this.frontMatterProcessor[value]();
						break;
					case "{{datetime}}":
						frontMatter[key] = this.frontMatterProcessor[value]();
						break;
					default:
						frontMatter[key] = value;
						break;
				}
			}
		}

		return frontMatter;
	}

	public async updateFrontMatterFromTemplate(
		template: string,
		originalFrontMatter: FrontMatterObject,
		file: TFile
	): Promise<FrontMatterObject> {
		const templateWithoutDashes = template.replace(/---/g, "").trim();
		if (templateWithoutDashes === "") {
			return originalFrontMatter;
		}

		const newFrontMatter: FrontMatterObject = {};
		const lines = templateWithoutDashes.split("\n");

		for (const line of lines) {
			const [key, value] = line.split(":").map((part) => part.trim());
			if (key && value) {
				switch (value) {
					case "{{title}}":
						newFrontMatter[key] = this.frontMatterProcessor[value](file.name);
						break;
					case "{{date}}":
						newFrontMatter[key] = this.frontMatterProcessor[value]();
						break;
					case "{{datetime}}":
						newFrontMatter[key] = this.frontMatterProcessor[value]();
						break;
					default:
						newFrontMatter[key] = value;
						break;
				}
			}
		}

		return { ...newFrontMatter, ...originalFrontMatter };
	}
}

class LinkProcessor {
	constructor(private app: App, private settings: JekyllExportSettings) {}

	public async obsidianLinkToMarkdown(content: string): Promise<string> {
		// Link 형태별 파싱 및 변환
		const lines = content.split("\n");
		const processedLines: string[] = [];

		for (const line of lines) {
			const newLine = await this.processLine(line);
			processedLines.push(newLine);
		}

		return processedLines.join("\n").trim();
	}

	private async processLine(line: string): Promise<string> {
		if (this.isMarkdownLink(line)) {
			return line; // 이미 MD 링크는 그대로
		}
		if (this.isObsidianLink(line)) {
			return this.convertObsidianLinkToMarkdown(line);
		}
		if (this.isObsidianImage(line)) {
			return await this.convertObsidianImage(line);
		}

		return line;
	}

	private isMarkdownLink(line: string): boolean {
		return /\[[^\]]*\]\([^)]*\)/.test(line);
	}

	private isObsidianLink(line: string): boolean {
		return /\[\[(.*?)\]\]/.test(line) && !line.includes("http") && !line.startsWith("![[");
	}

	private isObsidianImage(line: string): boolean {
		return /^!\[\[.*?\]\]$/.test(line);
	}

	private convertNormalLinkToMarkdown(line: string): string {
		return line.replace(/https?:\/\/[^\s]+/g, (match) => {
			return `[${match}](${match})`;
		});
	}

	private convertObsidianLinkToMarkdown(line: string): string {
		return line.replace(/\[\[(.*?)\]\]/g, (match, link) => {
			const parts = link.split("|");
			const title = parts[1] || parts[0];
			const url = parts[0].toLowerCase().replace(/ /g, "-");
			if (url.startsWith("http") || !url) {
				return match;
			}
			return `[${title}](${url})`;
		});
	}

	private async convertObsidianImage(line: string): Promise<string> {
		const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"];
		const match = line.match(/!\[\[([^\]|]+)(?:\|(\d+))?\]\]/);
		if (!match) return line;

		const [, imageName, width] = match;
		const resized = width ? `{:width="${width}px"}` : "";

		if (imageName.startsWith("http")) {
			return `![](${imageName})${resized}`;
		}

		if (!imageExtensions.some((ext) => imageName.toLowerCase().endsWith(ext))) {
			return line;
		}

		const imageFile = this.app.vault.getFiles().find((f) => f.path.endsWith(imageName));
		if (!imageFile) return line;

		try {
			const imageData = await this.app.vault.readBinary(imageFile);
			const sanitizedImageName = path.basename(imageName).toLowerCase().replace(/\s+/g, "-");
			const targetImagePath = path.join(this.settings.activeTargetFolder, this.settings.imageFolder, sanitizedImageName);
			await fs.mkdir(path.dirname(targetImagePath), { recursive: true });
			await fs.writeFile(targetImagePath, Buffer.from(imageData));

			const newImagePath = path.join(this.settings.imageFolder, sanitizedImageName);
			return `![](${newImagePath})${resized}`;
		} catch (error) {
			console.error(`Image processing error: ${error}`);
			new Notice(`Error processing image: ${imageName}`);
			return line;
		}
	}
}

class OpenAITagExtractor {
	private TAG_EXTRACTION_PROMPT = `
Given the following content, extract up to 10 relevant tags that best describe the main topics, technologies, concepts, or themes discussed.
Rules:
1. Return only the tags as a comma-separated list
2. Use lowercase for all tags
3. Replace spaces with hyphens in multi-word tags
4. Maximum 10 tags
5. No special characters except hyphens
6. No explanations, just the tags

Content:
`;

	constructor(private settings: JekyllExportSettings) {}

	public async extractTags(content: string): Promise<string[] | null> {
		if (!this.settings.useAutoTags) return null;
		if (!this.settings.openaiApiKey) {
			console.log("OpenAI API key not configured");
			return null;
		}

		try {
			const response = await fetch(`${this.settings.openaiApiBaseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.settings.openaiApiKey}`,
				},
				body: JSON.stringify({
					model: this.settings.openaiModel,
					messages: [
						{
							role: "system",
							content: "You are a tag extraction assistant. Extract relevant tags from the given content.",
						},
						{
							role: "user",
							content: this.TAG_EXTRACTION_PROMPT + content,
						},
					],
					temperature: 0.3,
					max_tokens: 100,
				}),
			});

			if (!response.ok) {
				new Notice(`API request failed: ${response.statusText}`);
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data = await response.json();
			const tagString = data.choices[0].message.content.trim();

			const tags = tagString
				.split(",")
				.map((tag: string) => tag.trim().toLowerCase())
				.filter((tag: string) => tag)
				.slice(0, 10);

			return tags;
		} catch (error) {
			new Notice("Error extracting tags");
			console.error("Error extracting tags:", error);
			return [];
		}
	}
}

class FileWriter {
	constructor(private app: App, private settings: JekyllExportSettings) {}

	public async writeFile(filePath: string, content: string): Promise<void> {
		try {
			await fs.writeFile(filePath, content, { encoding: "utf-8" });
		} catch (error) {
			new Notice(`파일 작성 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`파일 작성 실패: ${(error as Error).message}`);
		}
	}

	public async isFileExists(targetDir: string, pattern: string): Promise<{ path: string } | null> {
		try {
			const files = await fs.readdir(targetDir);
			const filteredFiles = files.filter((file) => file.includes(pattern));
			if (filteredFiles.length > 1) {
				throw new Error("같은 패턴을 가진 여러 파일이 존재합니다.");
			}

			return filteredFiles.length === 1 ? { path: path.join(targetDir, filteredFiles[0]) } : null;
		} catch (error) {
			new Notice(`파일 존재 여부 확인 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`파일 존재 확인 실패: ${(error as Error).message}`);
		}
	}

	public async mkDir(targetDir: string): Promise<void> {
		try {
			if (
				!(await fs
					.access(targetDir)
					.then(() => true)
					.catch(() => false))
			) {
				await fs.mkdir(targetDir, { recursive: true });
			}
		} catch (error) {
			new Notice(`디렉토리 생성 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`디렉토리 생성 실패: ${(error as Error).message}`);
		}
	}
}

enum OverwriteChoice {
	OverwriteFrontMatterAndContent,
	OverwriteContentOnly,
	Cancel,
}

class OverwriteModal extends Modal {
	private result: Promise<OverwriteChoice>;
	private resolvePromise!: (value: OverwriteChoice) => void;

	constructor(app: App) {
		super(app);
		this.result = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("overwrite-modal-content");

		const title = contentEl.createEl("h2", { text: MODAL_TITLE });
		title.addClass("overwrite-modal-title");

		const description = contentEl.createEl("p", {
			text: MODAL_DESCRIPTION,
		});
		description.addClass("overwrite-modal-description");

		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("overwrite-modal-button-container");

		this.createStyledButton(buttonContainer, BUTTON_TEXT_OVERWRITE_FRONTMATTER_AND_CONTENT, true, () => {
			this.resolvePromise(OverwriteChoice.OverwriteFrontMatterAndContent);
			this.close();
		});

		this.createStyledButton(buttonContainer, BUTTON_TEXT_OVERWRITE_CONTENT_ONLY, false, () => {
			this.resolvePromise(OverwriteChoice.OverwriteContentOnly);
			this.close();
		});

		this.createStyledButton(buttonContainer, BUTTON_TEXT_CANCEL, false, () => {
			this.resolvePromise(OverwriteChoice.Cancel);
			this.close();
		});
	}

	private createStyledButton(container: HTMLElement, text: string, isPrimary: boolean, callback: () => void): ButtonComponent {
		const btn = new ButtonComponent(container).setButtonText(text).onClick(callback);
		btn.buttonEl.classList.add(isPrimary ? "button-primary" : "button-secondary");
		return btn;
	}

	onClose() {
		this.contentEl.empty();
	}

	async getResult(): Promise<OverwriteChoice> {
		const result = await this.result;
		if (result === OverwriteChoice.Cancel) {
			new Notice("내보내기가 취소되었습니다.");
		}
		return result;
	}
}

class ObsidianContent {
	private frontMatter: FrontMatterObject;
	private contentBody: string;

	private overwriteModal: OverwriteModal;

	constructor(
		private app: App,
		private settings: JekyllExportSettings,
		private file: TFile,
		private frontMatterProcessor: FrontMatterProcessor,
		private linkProcessor: LinkProcessor,
		private openAITagExtractor: OpenAITagExtractor,
		private fileWriter: FileWriter
	) {
		this.overwriteModal = new OverwriteModal(this.app);
	}

	public async loadContent(): Promise<void> {
		try {
			const content = await this.app.vault.read(this.file);
			const { frontMatter, contentBody } = await this.frontMatterProcessor.parse(content);
			this.frontMatter = frontMatter;
			this.contentBody = contentBody;
		} catch (error) {
			new Notice(`콘텐츠 로드 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`콘텐츠 로드 실패: ${(error as Error).message}`);
		}
	}

	public async publish(targetDir: string): Promise<void> {
		try {
			const sentinizedFileName = this.getSentinizedFileName();
			await this.fileWriter.mkDir(targetDir);
			const isFileExists = await this.fileWriter.isFileExists(targetDir, sentinizedFileName);
			let updatedContentBody;

			if (isFileExists) {
				this.overwriteModal.open();
				const choice = await this.overwriteModal.getResult();

				if (choice === OverwriteChoice.Cancel) return;

				if (choice === OverwriteChoice.OverwriteFrontMatterAndContent) {
					try {
						const existFileContent = await fs.readFile(isFileExists.path, "utf-8");
						const { frontMatter: existFrontMatter } = await this.frontMatterProcessor.parse(existFileContent);
						const existNanoId = existFrontMatter.nanoId;
						if (existNanoId) this.frontMatter.nanoId = existNanoId;
					} catch (error) {
						new Notice(`기존 파일 덮어쓰기 중 오류 발생: ${(error as Error).message}`);
						throw new Error(`파일 덮어쓰기 실패: ${(error as Error).message}`);
					}
				}
			}

			try {
				this.frontMatter = await this.frontMatterProcessor.updateFrontMatterFromTemplate(
					this.settings.frontMatterTemplate,
					this.frontMatter,
					this.file
				);

				if (!this.frontMatter["nanoId"]) {
					this.frontMatter["nanoId"] = alphaNumNanoId();
				}

				this.frontMatter["permalink"] = `/${this.frontMatter["nanoId"]}/`;

				const autoGeneratedTags = await this.openAITagExtractor.extractTags(this.contentBody);
				if (autoGeneratedTags) this.frontMatter["tags"] = autoGeneratedTags;

				updatedContentBody = await this.linkProcessor.obsidianLinkToMarkdown(this.contentBody);
				const targetFilePath = path.join(targetDir, this.addDateToTitle(sentinizedFileName));

				await this.fileWriter.writeFile(targetFilePath, this.stringify(this.frontMatter, updatedContentBody));
				await this.app.vault.modify(this.file, this.stringify(this.frontMatter, this.contentBody));

				if (isFileExists && isFileExists.path !== targetFilePath) {
					await fs.unlink(isFileExists.path);
				}

				if (!isFileExists) {
					new Notice("파일이 정상적으로 Jekyll로 내보내졌습니다.");
				}
			} catch (error) {
				new Notice(`파일 내보내기 중 오류 발생: ${(error as Error).message}`);
				throw new Error(`파일 내보내기 실패: ${(error as Error).message}`);
			}
		} catch (error) {
			new Notice(`내보내기 과정에서 오류가 발생했습니다: ${(error as Error).message}`);
			throw error;
		}
	}

	// --------- private methods ---------
	private stringify(frontMatter: FrontMatterObject, contentBody: string): string {
		return `---\n${yaml.stringify(frontMatter)}---\n${contentBody}`;
	}

	private getSentinizedFileName(): string {
		return sentinize(this.file.name);
	}

	private addDateToTitle(title: string): string {
		const date = new Date().toISOString().split("T")[0];
		return `${date}-${title}`;
	}
}

class JekyllExporter {
	private obsidianContent: ObsidianContent;

	constructor(private app: App, private settings: JekyllExportSettings) {}

	public async loadContent(obsidianContent: ObsidianContent) {
		this.obsidianContent = obsidianContent;
		await this.obsidianContent.loadContent();
	}

	public async exportFile(targetPath: string) {
		try {
			await this.obsidianContent.publish(targetPath);
		} catch (error) {
			new Notice(`파일 내보내기 실패: ${(error as Error).message}`);
			throw new Error(`exportFile 실패: ${(error as Error).message}`);
		}
	}
}

class JekyllExportSettingTab extends PluginSettingTab {
	plugin: JekyllExportPlugin;
	newFolderInput!: TextComponent;

	constructor(app: App, plugin: JekyllExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("jekyll-export-plugin");
		containerEl.addClass("jekyll-settings-container");

		// Target folders
		const targetSection = containerEl.createDiv("jekyll-settings-section");
		targetSection.createEl("h2", { text: "Target Folders" });

		const foldersContainer = targetSection.createDiv("folders-container");
		this.plugin.settings.targetFolders.forEach((folder, index) => {
			const folderDiv = foldersContainer.createDiv("folder-item");
			folderDiv.createSpan({ text: folder, cls: "folder-path" });

			new ButtonComponent(folderDiv)
				.setButtonText(BUTTON_DELETE)
				.setClass("jekyll-button")
				.setClass("danger")
				.onClick(async () => {
					this.plugin.settings.targetFolders.splice(index, 1);
					if (this.plugin.settings.activeTargetFolder === folder) {
						this.plugin.settings.activeTargetFolder = this.plugin.settings.targetFolders[0] || "";
					}
					await this.plugin.saveSettings();
					this.display();
				});
		});

		new Setting(targetSection)
			.setName("Add New Target Folder")
			.setDesc("Jekyll site root path")
			.addText((text) => {
				this.newFolderInput = text;
				text.inputEl.addClass("folder-input");
				text.setPlaceholder("/path/to/jekyll/site");
			})
			.addButton((button) => {
				button
					.setButtonText(BUTTON_ADD)
					.setClass("jekyll-button")
					.onClick(async () => {
						const value = this.newFolderInput.getValue().trim();
						if (value && !this.plugin.settings.targetFolders.includes(value)) {
							try {
								await fs.access(value);
								this.plugin.settings.targetFolders.push(value);
								if (this.plugin.settings.targetFolders.length === 1) {
									this.plugin.settings.activeTargetFolder = value;
								}
								await this.plugin.saveSettings();
								this.newFolderInput.setValue("");
								this.display();
							} catch {
								new Notice("Invalid folder path.");
							}
						} else {
							new Notice("Folder already exists or is invalid.");
						}
					});
			});

		// Active folder
		const activeSection = containerEl.createDiv("jekyll-settings-section");
		activeSection.createEl("h2", { text: "Active Target Folder" });

		new Setting(activeSection)
			.setName("Select Active Folder")
			.setDesc("Choose the active target folder for exports.")
			.addDropdown((dropdown) => {
				this.plugin.settings.targetFolders.forEach((folder) => {
					dropdown.addOption(folder, folder);
				});
				dropdown.setValue(this.plugin.settings.activeTargetFolder || "");
				dropdown.selectEl.addClass("folder-select");
				dropdown.onChange(async (value) => {
					try {
						await fs.access(value);
						this.plugin.settings.activeTargetFolder = value;
						new Notice("Selected folder activated.");
					} catch {
						new Notice("Selected folder does not exist.");
					}
					await this.plugin.saveSettings();
				});
			});

		// Front matter
		const fmSection = containerEl.createDiv("jekyll-settings-section");
		fmSection.createEl("h2", { text: "Front Matter Settings" });

		new Setting(fmSection)
			.setName("Front Matter Template")
			.setDesc("Default Front Matter template")
			.addTextArea((text) => {
				text.inputEl.addClass("front-matter-textarea");
				text
					.setPlaceholder(DEFAULT_FRONT_MATTER_TEMPLATE)
					.setValue(this.plugin.settings.frontMatterTemplate)
					.onChange(async (value: string) => {
						this.plugin.settings.frontMatterTemplate = value;
						await this.plugin.saveSettings();
						new Notice("Front Matter 템플릿이 업데이트되었습니다.");
					});
			});

		// Images
		const imageSection = containerEl.createDiv("jekyll-settings-section");
		imageSection.createEl("h2", { text: "Image Settings" });

		new Setting(imageSection)
			.setName("Image Folder")
			.setDesc("Image storage path in Jekyll site")
			.addText((text) => {
				text
					.setPlaceholder("assets/img")
					.setValue(this.plugin.settings.imageFolder)
					.onChange(async (value) => {
						this.plugin.settings.imageFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		// OpenAI
		const openaiSection = containerEl.createDiv("jekyll-settings-section");
		openaiSection.createEl("h2", { text: "OpenAI Settings" });

		new Setting(openaiSection)
			.setName("API Base URL")
			.setDesc("OpenAI API base URL")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.openaiApiBaseUrl)
					.setPlaceholder("https://api.openai.com/v1")
					.onChange(async (value) => {
						this.plugin.settings.openaiApiBaseUrl = value.trim();
						await this.plugin.saveSettings();
					});
			});

		const OPENAI_MODELS = ["gpt-4", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo", "custom"];

		let customModelInput: TextComponent;

		new Setting(openaiSection)
			.setName("Model")
			.setDesc("Select OpenAI model or enter custom model name")
			.addDropdown((dropdown) => {
				const currentModel = this.plugin.settings.openaiModel;
				const value = OPENAI_MODELS.includes(currentModel) ? currentModel : "custom";
				OPENAI_MODELS.forEach((model) => dropdown.addOption(model, model));
				dropdown.setValue(value);
				dropdown.onChange(async (val) => {
					if (val === "custom") {
						customModelInput.inputEl.style.display = "block";
					} else {
						customModelInput.inputEl.style.display = "none";
						this.plugin.settings.openaiModel = val;
						await this.plugin.saveSettings();
					}
				});
			})
			.addText((text) => {
				customModelInput = text;
				text
					.setPlaceholder("Enter custom model name")
					.setValue(OPENAI_MODELS.includes(this.plugin.settings.openaiModel) ? "" : this.plugin.settings.openaiModel)
					.onChange(async (value) => {
						if (value) {
							this.plugin.settings.openaiModel = value.trim();
							await this.plugin.saveSettings();
						}
					});
				text.inputEl.style.display = OPENAI_MODELS.includes(this.plugin.settings.openaiModel) ? "none" : "block";
			});

		new Setting(openaiSection)
			.setName("API Key")
			.setDesc("Your OpenAI API key")
			.addText((text) => {
				text.setValue(this.plugin.settings.openaiApiKey).setPlaceholder("sk-...").inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(openaiSection)
			.setName("Test API Connection")
			.setDesc("Test your OpenAI API connection")
			.addButton((button) => {
				button
					.setButtonText("Test Connection")
					.setClass("jekyll-button")
					.onClick(async () => {
						try {
							const response = await fetch(`${this.plugin.settings.openaiApiBaseUrl}/chat/completions`, {
								method: "POST",
								headers: {
									"Content-Type": "application/json",
									Authorization: `Bearer ${this.plugin.settings.openaiApiKey}`,
								},
								body: JSON.stringify({
									model: this.plugin.settings.openaiModel,
									messages: [
										{
											role: "user",
											content: "Hello! This is a test message.",
										},
									],
								}),
							});

							if (response.ok) {
								new Notice("API connection successful!");
							} else {
								const error = await response.json();
								new Notice(`API connection failed: ${error.error?.message || "Unknown error"}`);
							}
						} catch (error: any) {
							new Notice(`API connection failed: ${error.message}`);
						}
					});
			});

		new Setting(openaiSection)
			.setName("Auto Tag Generation")
			.setDesc("Automatically generate tags using OpenAI")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.useAutoTags).onChange(async (value) => {
					this.plugin.settings.useAutoTags = value;
					await this.plugin.saveSettings();
				});
			});
	}
}

export default class JekyllExportPlugin extends Plugin {
	settings: JekyllExportSettings;
	private exporter!: JekyllExporter;

	async onload() {
		try {
			injectStyles(MODAL_CSS);
			injectStyles(SETTINGS_CSS);

			await this.loadSettings();

			this.exporter = new JekyllExporter(this.app, this.settings);

			this.addRibbonIcon(ICON_UPLOAD, "Export to Jekyll", () => {
				try {
					const activeFile = this.app.workspace.getActiveFile();
					if (activeFile && activeFile.extension === "md") {
						this.exportToJekyll(activeFile);
					} else {
						new Notice("열려 있는 마크다운 파일이 없습니다.");
					}
				} catch (error) {
					new Notice(`리본 아이콘 클릭 중 오류 발생: ${(error as Error).message}`);
					console.error(error);
				}
			});

			this.registerEvent(
				this.app.workspace.on("file-menu", (menu, file) => {
					if (file instanceof TFile && file.extension === "md") {
						menu.addItem((item) => {
							item
								.setTitle(BUTTON_EXPORT)
								.setIcon(ICON_UPLOAD)
								.onClick(() => {
									try {
										this.exportToJekyll(file as TFile);
									} catch (error) {
										new Notice(`파일 메뉴에서 내보내기 중 오류 발생: ${(error as Error).message}`);
										console.error(error);
									}
								});
						});
					}
				})
			);

			this.addSettingTab(new JekyllExportSettingTab(this.app, this));
		} catch (error) {
			new Notice(`플러그인 로드 중 오류 발생: ${(error as Error).message}`);
			console.error(error);
		}
	}

	async loadSettings() {
		try {
			const data = await this.loadData();
			this.settings = { ...DEFAULT_SETTINGS, ...data };
		} catch (error) {
			new Notice(`설정 불러오기 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`설정 불러오기 실패: ${(error as Error).message}`);
		}
	}

	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			new Notice(`설정 저장 중 오류 발생: ${(error as Error).message}`);
			throw new Error(`설정 저장 실패: ${(error as Error).message}`);
		}
	}

	private async exportToJekyll(file: TFile) {
		try {
			new Notice("Jekyll로 내보내기를 시작합니다.");
			await this.exporter.loadContent(
				new ObsidianContent(
					this.app,
					this.settings,
					file,
					new FrontMatterProcessor(this.app, this.settings),
					new LinkProcessor(this.app, this.settings),
					new OpenAITagExtractor(this.settings),
					new FileWriter(this.app, this.settings)
				)
			);

			const fileDir = path.dirname(file.path);
			await this.exporter.exportFile(path.join(this.settings.activeTargetFolder, fileDir, "_posts"));

			new Notice("Jekyll 내보내기가 완료되었습니다.");
		} catch (error) {
			new Notice(`Jekyll로 내보내기 중 오류 발생: ${(error as Error).message}`);
			console.error(error);
		}
	}
}
