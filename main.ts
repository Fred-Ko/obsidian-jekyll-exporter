import * as fs from "fs/promises";
import { customAlphabet } from "nanoid";
import { App, ButtonComponent, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFile } from "obsidian";
import * as path from "path";
// ========================= Constants =========================

const BUTTON_TEXT_OVERWRITE_FRONTMATTER_AND_CONTENT = "Overwrite Date and Content";
const BUTTON_TEXT_OVERWRITE_CONTENT_ONLY = "Overwrite Content Only";
const BUTTON_TEXT_CANCEL = "Cancel";
const MODAL_TITLE = "File Already Exists";
const MODAL_DESCRIPTION = "Please select how to handle the existing file.";
const BUTTON_ADD = "Add";
const BUTTON_DELETE = "Delete";
const BUTTON_EXPORT = "Export to Jekyll";
const ICON_UPLOAD = "upload";

const DEFAULT_FRONT_MATTER_TEMPLATE = "---\ntitle: {{title}}\ndate: {{date}}\ntags: {{tags}}\n---\n";

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

enum OverwriteChoice {
	OverwriteDateAndContent = 1,
	OverwriteContentOnly,
	Cancel,
}

// ========================= Interfaces =========================

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

// ========================= Utility Functions =========================

function alphaNumNanoId(): string {
	const alphaNum = "123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	return customAlphabet(alphaNum, 25)();
}

function injectStyles(css: string) {
	const style = document.createElement("style");
	style.innerHTML = css;
	document.head.appendChild(style);
}

function createStyledButton(container: HTMLElement, text: string, isPrimary: boolean, callback: () => void): ButtonComponent {
	const btn = new ButtonComponent(container).setButtonText(text).onClick(callback);
	btn.buttonEl.classList.add(isPrimary ? "button-primary" : "button-secondary");
	return btn;
}

// ========================= Modal Class =========================

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

		createStyledButton(buttonContainer, BUTTON_TEXT_OVERWRITE_FRONTMATTER_AND_CONTENT, true, () => {
			this.resolvePromise(OverwriteChoice.OverwriteDateAndContent);
			this.close();
		});

		createStyledButton(buttonContainer, BUTTON_TEXT_OVERWRITE_CONTENT_ONLY, false, () => {
			this.resolvePromise(OverwriteChoice.OverwriteContentOnly);
			this.close();
		});

		createStyledButton(buttonContainer, BUTTON_TEXT_CANCEL, false, () => {
			this.resolvePromise(OverwriteChoice.Cancel);
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}

	async getResult(): Promise<OverwriteChoice> {
		return this.result;
	}
}

// ========================= SRP Classes =========================

class FrontMatterProcessor {
	private readonly frontMatterRegex = /^---\r?\n[\s\S]*?\r?\n---/;
	private readonly frontMatterProcessors = {
		"{{title}}": (title: string) => title,
		"{{date}}": () => new Date().toISOString().split("T")[0],
		"{{datetime}}": () => new Date().toISOString(),
		"{{nanoId}}": () => alphaNumNanoId(),
	};

	constructor(private app: App, private settings: JekyllExportSettings, private openAITagExtractor: OpenAITagExtractor) {}

	public async addTemplateFrontMatter(file: TFile): Promise<string> {
		const content = await this.app.vault.read(file);
		const tags = await this.openAITagExtractor.extractTags(content);

		const filePath = file.path;
		const title = path.basename(filePath, ".md");
		const hasFrontMatter = this.hasFrontMatter(content);

		if (!hasFrontMatter) {
			let newFrontMatter = this.settings.frontMatterTemplate;
			Object.entries(this.frontMatterProcessors).forEach(([key, processor]) => {
				switch (key) {
					case "{{title}}":
						newFrontMatter = newFrontMatter.replace(key, this.frontMatterProcessors[key](title));
						break;
					case "{{date}}":
						newFrontMatter = newFrontMatter.replace(key, this.frontMatterProcessors[key]());
						break;
					case "{{datetime}}":
						newFrontMatter = newFrontMatter.replace(key, this.frontMatterProcessors[key]());
						break;
					case "{{nanoId}}":
						newFrontMatter = newFrontMatter.replace(key, this.frontMatterProcessors[key]());
						break;
				}
			});

			newFrontMatter = this.setFrontMatterAttribute(newFrontMatter, "tags", tags.join(", "));

			return newFrontMatter + content;
		}

		return content;
	}

	public removeEmptyLinesFromFrontMatter(content: string): string {
		const match = content.match(this.frontMatterRegex);
		if (!match) {
			// 프론트매터가 없으면 원본 콘텐츠 반환
			return content;
		}

		const frontMatter = match[0];
		const lines = frontMatter.split(/\r?\n/);
		// 프론트매터의 시작과 끝을 제외한 중간 부분에서 빈 줄 제거
		const cleanedLines = lines.filter((line, index) => {
			// 첫 번째와 마지막 줄(`---`)은 유지
			if (index === 0 || index === lines.length - 1) {
				return true;
			}
			// 중간의 빈 줄은 제거
			return line.trim() !== "";
		});

		const cleanedFrontMatter = cleanedLines.join("\n");
		// 원본 콘텐츠에서 기존 프론트매터를 제거하고, 정리된 프론트매터로 대체
		const updatedContent = content.replace(this.frontMatterRegex, cleanedFrontMatter);

		return updatedContent;
	}

	public hasFrontMatter(content: string): boolean {
		return this.frontMatterRegex.test(content);
	}

	public replaceFrontMatter(content: string, frontMatter: string): string {
		const existingFrontMatter = this.getFrontMatter(content);
		if (!existingFrontMatter) {
			return frontMatter + content;
		}
		return content.replace(existingFrontMatter, frontMatter);
	}

	public removeFrontMatter(content: string): string {
		return content.replace(this.frontMatterRegex, "");
	}

	public getFrontMatter(content: string): string | null {
		const frontMatter = content.match(this.frontMatterRegex);
		return frontMatter ? frontMatter[0] : null;
	}

	private isValidFrontMatter(frontMatter: string): boolean {
		return this.frontMatterRegex.test(frontMatter);
	}

	public getFrontMatterAttribute(frontMatter: string, attributeKey: string): string | null {
		if (!this.isValidFrontMatter(frontMatter)) {
			throw new Error("Invalid front matter");
		}

		const regex = new RegExp(`^${attributeKey}:\\s*(.*)$`, "m");
		const match = frontMatter.match(regex);
		return match ? match[1].trim() : null;
	}

	public setFrontMatterAttribute(frontMatter: string, attributeKey: string, attributeValue: string): string {
		if (!this.isValidFrontMatter(frontMatter)) {
			return `---\n${attributeKey}: ${attributeValue}\n---`;
		}

		const regex = new RegExp(`^(${attributeKey}:\\s*)(.*)$`, "m");
		if (frontMatter.match(regex)) {
			// 해당 속성이 이미 존재하면 업데이트
			return frontMatter.replace(regex, `$1${attributeValue}`);
		} else {
			// 속성이 없으면 추가
			const endOfFrontMatter = frontMatter.indexOf("---", 3);
			if (endOfFrontMatter !== -1) {
				return frontMatter.slice(0, endOfFrontMatter) + `\n${attributeKey}: ${attributeValue}\n` + frontMatter.slice(endOfFrontMatter);
			} else {
				// 예상치 못한 경우 새롭게 추가
				return frontMatter + `\n${attributeKey}: ${attributeValue}\n---`;
			}
		}
	}
}

class LinkProcessor {
	constructor(private app: App, private settings: JekyllExportSettings) {}

	public async processLinks(content: string): Promise<string> {
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
		return line; // 별도 처리 필요 없는 라인
	}

	private isMarkdownLink(line: string): boolean {
		return /\[[^\]]*\]\([^)]*\)/.test(line);
	}

	private isObsidianLink(line: string): boolean {
		// [[Link]] 혹은 [[Link|Title]] 형태이며 http가 포함되지 않은 경우
		return /\[\[(.*?)\]\]/.test(line) && !line.includes("http") && !line.startsWith("![[");
	}

	private isObsidianImage(line: string): boolean {
		return /^!\[\[.*?\]\]$/.test(line);
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

	public async extractTags(content: string): Promise<string[]> {
		if (!this.settings.useAutoTags) return [];
		if (!this.settings.openaiApiKey) {
			console.log("OpenAI API key not configured");
			return [];
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
			console.error("Error extracting tags:", error);
			return [];
		}
	}
}

class AddPermaLinkAndNanoIDFileWriter {
	constructor(private app: App, private frontMatterProcessor: FrontMatterProcessor) {}

	public async writeContentToTargetPathAndSync(targetPath: string, content: string, file: TFile): Promise<string> {
		async function fileExists(path: string): Promise<boolean> {
			try {
				await fs.access(path);
				return true;
			} catch {
				return false;
			}
		}

		let processedContent = content;
		if (await fileExists(targetPath)) {
			const existingContent = await fs.readFile(targetPath, "utf8");
			const existingFrontMatter = this.frontMatterProcessor.getFrontMatter(existingContent);
			if (existingFrontMatter) {
				const existingNanoId = this.frontMatterProcessor.getFrontMatterAttribute(existingFrontMatter, "nanoId");
				if (existingNanoId) {
					processedContent = this.frontMatterProcessor.setFrontMatterAttribute(
						this.frontMatterProcessor.replaceFrontMatter(content, existingFrontMatter),
						"nanoId",
						existingNanoId
					);
				} else {
					processedContent = await this.addNanoID(content);
				}
			} else {
				processedContent = await this.addNanoID(content);
			}
		}

		processedContent = await this.addPermaLink(processedContent);
		processedContent = this.frontMatterProcessor.removeEmptyLinesFromFrontMatter(processedContent);
		await fs.writeFile(targetPath, processedContent, "utf8");
		const originalContent = await this.app.vault.read(file);
		// 원본파일에 덮어쓰기
		await this.app.vault.modify(
			file,
			this.frontMatterProcessor.getFrontMatter(processedContent) + this.frontMatterProcessor.removeFrontMatter(originalContent)
		);
		return targetPath;
	}

	private async addPermaLink(content: string): Promise<string> {
		const frontMatter = this.frontMatterProcessor.getFrontMatter(content);
		if (frontMatter) {
			let newFrontMatter = frontMatter;
			let modified = false;

			// nanoId가 없는 경우 생성 및 추가
			let nanoId = this.frontMatterProcessor.getFrontMatterAttribute(frontMatter, "nanoId");
			if (!nanoId) {
				nanoId = alphaNumNanoId();
				newFrontMatter = this.frontMatterProcessor.setFrontMatterAttribute(newFrontMatter, "nanoId", nanoId);
				modified = true;
			}

			// permalink가 없는 경우 nanoId를 사용하여 생성 및 추가
			const permalink = this.frontMatterProcessor.getFrontMatterAttribute(newFrontMatter, "permalink");
			if (!permalink && nanoId) {
				newFrontMatter = this.frontMatterProcessor.setFrontMatterAttribute(newFrontMatter, "permalink", `/${nanoId}/`);
				modified = true;
			}

			// 수정된 프론트 매터가 있을 경우 교체
			if (modified) {
				return this.frontMatterProcessor.replaceFrontMatter(content, newFrontMatter);
			}
		}

		return content;
	}

	private async addNanoID(content: string): Promise<string> {
		const frontMatter = this.frontMatterProcessor.getFrontMatter(content);
		if (frontMatter) {
			if (this.frontMatterProcessor.getFrontMatterAttribute(frontMatter, "nanoId")) {
				return content;
			} else {
				const newFrontMatter = this.frontMatterProcessor.setFrontMatterAttribute(frontMatter, "nanoId", alphaNumNanoId());
				return this.frontMatterProcessor.replaceFrontMatter(content, newFrontMatter);
			}
		}

		return content;
	}
}

class OverwriteHandler {
	constructor(
		private app: App,
		private frontMatterProcessor: FrontMatterProcessor,
		private linkProcessor: LinkProcessor,
		private addPermaLinkAndNanoIDFileWriter: AddPermaLinkAndNanoIDFileWriter
	) {}

	public async handleExistingFile(existingFilePath: string, file: TFile): Promise<string | null> {
		const modal = new OverwriteModal(this.app);
		modal.open();
		const choice = await modal.getResult();

		switch (choice) {
			case OverwriteChoice.OverwriteDateAndContent:
				let processedContent = await this.frontMatterProcessor.addTemplateFrontMatter(file);
				processedContent = await this.linkProcessor.processLinks(processedContent);

				return await this.addPermaLinkAndNanoIDFileWriter.writeContentToTargetPathAndSync(existingFilePath, processedContent, file);
			case OverwriteChoice.OverwriteContentOnly:
				const content = await this.app.vault.read(file);
				return await this.overwriteContentOnly(existingFilePath, content, file);
			case OverwriteChoice.Cancel:
				return null;
			default:
				throw new Error("Overwrite choice is invalid");
		}
	}

	private async overwriteContentOnly(existingFilePath: string, newContent: string, file: TFile): Promise<string> {
		try {
			const existingContent = await fs.readFile(existingFilePath, "utf8");
			const existingFM = this.frontMatterProcessor.getFrontMatter(existingContent);
			const newFM = this.frontMatterProcessor.getFrontMatter(newContent);

			if (existingFM && newFM) {
				const newBodyContent = this.frontMatterProcessor.removeFrontMatter(newContent);
				const updatedContent = `${existingFM}\n${newBodyContent}`;
				await this.addPermaLinkAndNanoIDFileWriter.writeContentToTargetPathAndSync(existingFilePath, updatedContent, file);
			} else {
				await this.addPermaLinkAndNanoIDFileWriter.writeContentToTargetPathAndSync(existingFilePath, newContent, file);
			}
			return existingFilePath;
		} catch (error) {
			console.error("Error overwriting content:", error);
			new Notice("An error occurred while overwriting content.");
			return existingFilePath;
		}
	}
}

// ========================= JekyllExporter =========================

class JekyllExporter {
	constructor(
		private app: App,
		private settings: JekyllExportSettings,
		private frontMatterProcessor: FrontMatterProcessor,
		private linkProcessor: LinkProcessor,
		private overwriteHandler: OverwriteHandler,
		private addPermaLinkAndNanoIDFileWriter: AddPermaLinkAndNanoIDFileWriter
	) {}

	public async exportFile(file: TFile): Promise<string | null> {
		const targetDir = this.settings.activeTargetFolder;
		if (!targetDir) {
			new Notice("No active target folder set.");
			return null;
		}

		try {
			await fs.access(targetDir);
		} catch {
			new Notice("Active target folder does not exist.");
			return null;
		}

		return await this.processFile(file, targetDir);
	}

	private async processFile(file: TFile, targetDir: string): Promise<string | null> {
		try {
			const fileName = this.createJekyllFileName(file);
			const relativeDir = path.dirname(file.path);
			const targetPath = path.join(targetDir, relativeDir, "_posts", fileName);
			await fs.mkdir(path.dirname(targetPath), { recursive: true });

			const existingFilePath = await this.findExistingFile(path.dirname(targetPath), file);
			if (existingFilePath) {
				return await this.overwriteHandler.handleExistingFile(existingFilePath, file);
			} else {
				let content = await this.app.vault.read(file);
				content = await this.frontMatterProcessor.addTemplateFrontMatter(file);
				content = await this.linkProcessor.processLinks(content);
				await this.addPermaLinkAndNanoIDFileWriter.writeContentToTargetPathAndSync(targetPath, content, file);
				return targetPath;
			}
		} catch (error) {
			console.error("Error processing file:", error);
			new Notice("An error occurred while processing the file.");
			return null;
		}
	}

	private createJekyllFileName(file: TFile): string {
		const date = new Date().toISOString().split("T")[0];
		const title = file.basename.replace(/\s+/g, "-");
		return `${date}-${title}.md`;
	}

	private async findExistingFile(targetPostsDir: string, file: TFile): Promise<string | null> {
		try {
			const files = await fs.readdir(targetPostsDir);
			const currentTitle = file.basename.replace(/\s+/g, "-");
			const existingFile = files.find((f) => {
				const match = f.match(/^\d{4}-\d{2}-\d{2}-(.*)\.md$/);
				return match && match[1] === currentTitle;
			});
			return existingFile ? path.join(targetPostsDir, existingFile) : null;
		} catch (error) {
			console.error("Error searching for existing file:", error);
			return null;
		}
	}
}

// ========================= Settings Tab =========================

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

// ========================= Plugin Class =========================

export default class JekyllExportPlugin extends Plugin {
	settings: JekyllExportSettings;
	private exporter!: JekyllExporter;

	async onload() {
		injectStyles(MODAL_CSS);
		injectStyles(SETTINGS_CSS);

		await this.loadSettings();

		const tagExtractor = new OpenAITagExtractor(this.settings);
		const frontMatterProcessor = new FrontMatterProcessor(this.app, this.settings, tagExtractor);
		const addPermaLinkAndNanoIDFileWriter = new AddPermaLinkAndNanoIDFileWriter(this.app, frontMatterProcessor);
		const linkProcessor = new LinkProcessor(this.app, this.settings);
		const overwriteHandler = new OverwriteHandler(this.app, frontMatterProcessor, linkProcessor, addPermaLinkAndNanoIDFileWriter);

		this.exporter = new JekyllExporter(
			this.app,
			this.settings,
			frontMatterProcessor,
			linkProcessor,
			overwriteHandler,
			addPermaLinkAndNanoIDFileWriter
		);

		this.addRibbonIcon(ICON_UPLOAD, "Export to Jekyll", () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile && activeFile.extension === "md") {
				this.exportToJekyll(activeFile);
			} else {
				new Notice("No markdown file is open.");
			}
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item
							.setTitle(BUTTON_EXPORT)
							.setIcon(ICON_UPLOAD)
							.onClick(() => this.exportToJekyll(file as TFile));
					});
				}
			})
		);

		this.addSettingTab(new JekyllExportSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async exportToJekyll(file: TFile) {
		try {
			const targetPath = await this.exporter.exportFile(file);
			if (!targetPath) {
				new Notice("Export was cancelled or an error occurred.");
				return;
			}
			await this.saveSettings();
			new Notice("Jekyll export completed. Path: " + targetPath);
		} catch (error) {
			console.error("Error during Jekyll export:", error);
			new Notice("An error occurred during Jekyll export.");
		}
	}
}
