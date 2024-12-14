import * as fs from "fs/promises";
import {
	App,
	ButtonComponent,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TextComponent,
	TFile,
} from "obsidian";
import * as path from "path";

// ========================= Constants =========================

const BUTTON_TEXT_OVERWRITE_DATE_AND_CONTENT = "Overwrite Date and Content";
const BUTTON_TEXT_OVERWRITE_CONTENT_ONLY = "Overwrite Content Only";
const BUTTON_TEXT_CANCEL = "Cancel";
const MODAL_TITLE = "File Already Exists";
const MODAL_DESCRIPTION = "Please select how to handle the existing file.";
const BUTTON_ADD = "Add";
const BUTTON_DELETE = "Delete";
const BUTTON_EXPORT = "Export to Jekyll";
const ICON_UPLOAD = "upload";
const DEFAULT_FRONT_MATTER_TEMPLATE =
	"---\ntitle: {{title}}\ndate: {{date}}\ntags: {{tags}}\n---\n";

// CSS Styles to be injected
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

// Constants 섹션에 새로운 CSS 추가
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

    /* 새 폴더 추가 입력 필드 */
    .folder-input {
        font-size: 14px !important;
        padding: 8px 12px !important;
        width: 100% !important;
        background: var(--background-primary) !important;
        box-sizing: border-box !important;
    }

    /* 드롭다운 스타일 */
    .folder-select {
        width: 100% !important;
        max-width: none !important;
        padding: 8px 12px !important;
        background: var(--background-primary) !important;
        border-radius: 4px !important;
        margin-top: 8px !important;
        box-sizing: border-box !important;
    }

    /* Front Matter 텍스트 영역 */
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

    /* 설정 아이템 간격 조정 */
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

    /* 드롭다운과 입력 필드 컨테이너 */
    .setting-item-control {
        width: 350px !important;
        padding-right: 0 !important;
        flex: 0 0 auto !important;
    }

    /* 모든 입력 필드에 대한 공통 스타일 */
    .setting-item input[type="text"] {
        width: 100% !important;
        font-size: 14px !important;
        padding: 8px 12px !important;
        background: var(--background-primary) !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
    }

    /* 버튼 스타일 */
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

    /* 반응형 조정 */
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

// ========================= Enums =========================

enum OverwriteChoice {
	OverwriteDateAndContent = 1,
	OverwriteContentOnly,
	Cancel,
}

// ========================= Interfaces =========================

// Plugin settings interface
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

// ========================= Default Settings =========================

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

// ========================= Helper Functions =========================

// Create a styled button
function createStyledButton(
	container: HTMLElement,
	text: string,
	isPrimary: boolean,
	callback: () => void
): ButtonComponent {
	const btn = new ButtonComponent(container)
		.setButtonText(text)
		.onClick(callback);
	btn.buttonEl.classList.add(
		isPrimary ? "button-primary" : "button-secondary"
	);
	return btn;
}

// Inject CSS styles into the document
function injectStyles(css: string) {
	const style = document.createElement("style");
	style.innerHTML = css;
	document.head.appendChild(style);
}

// ========================= Modal Classes =========================

// File overwrite selection modal
class OverwriteModal extends Modal {
	private result: Promise<OverwriteChoice>;
	private resolvePromise!: (value: OverwriteChoice) => void;

	constructor(app: App) {
		super(app);
		this.result = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	// Configure UI when modal opens
	onOpen() {
		const { contentEl } = this;

		// Add CSS class for styling
		contentEl.addClass("overwrite-modal-content");

		// Title
		const title = contentEl.createEl("h2", { text: MODAL_TITLE });
		title.addClass("overwrite-modal-title");

		// Description
		const description = contentEl.createEl("p", {
			text: MODAL_DESCRIPTION,
		});
		description.addClass("overwrite-modal-description");

		// Button container
		const buttonContainer = contentEl.createDiv();
		buttonContainer.addClass("overwrite-modal-button-container");

		// Create buttons
		createStyledButton(
			buttonContainer,
			BUTTON_TEXT_OVERWRITE_DATE_AND_CONTENT,
			true,
			() => {
				this.resolvePromise(OverwriteChoice.OverwriteDateAndContent);
				this.close();
			}
		);

		createStyledButton(
			buttonContainer,
			BUTTON_TEXT_OVERWRITE_CONTENT_ONLY,
			false,
			() => {
				this.resolvePromise(OverwriteChoice.OverwriteContentOnly);
				this.close();
			}
		);

		createStyledButton(buttonContainer, BUTTON_TEXT_CANCEL, false, () => {
			this.resolvePromise(OverwriteChoice.Cancel);
			this.close();
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	// Returns the user's choice
	async getResult(): Promise<OverwriteChoice> {
		return this.result;
	}
}

// ========================= Exporter Class =========================

// Class responsible for file processing and conversion
class JekyllExporter {
	private app: App;
	private settings: JekyllExportSettings;

	constructor(app: App, settings: JekyllExportSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Converts a given file to Jekyll format and exports it to the target folder.
	 * @param file The TFile to convert
	 */
	public async exportFile(file: TFile): Promise<string | null> {
		const targetDir = this.settings.activeTargetFolder;
		if (!targetDir) {
			new Notice("No active target folder set.");
			return null;
		}

		try {
			// Verify target directory exists
			await fs.access(targetDir);
		} catch {
			new Notice("Active target folder does not exist.");
			return null;
		}

		// Process the file
		return await this.processFile(file, targetDir);
	}

	/**
	 * Processes the file and returns the path to the exported file.
	 * If a file with the same name exists, handles according to user's choice.
	 */
	private async processFile(
		file: TFile,
		targetDir: string
	): Promise<string | null> {
		try {
			let content = await this.app.vault.read(file);

			// Add/Update Front Matter
			content = await this.processFrontMatter(content, file.path);

			// 링크 처리 통합
			content = await this.processLinks(content);

			// Create Jekyll file name
			const fileName = this.createJekyllFileName(file);
			const relativeDir = path.dirname(file.path);

			// Specify _posts directory
			const targetPath = path.join(
				targetDir,
				relativeDir,
				"_posts",
				fileName
			);
			const targetPostsDir = path.dirname(targetPath);

			// Create directories
			await fs.mkdir(targetPostsDir, { recursive: true });

			// Check if file exists
			const existingFilePath = await this.findExistingFile(
				targetPostsDir,
				file
			);
			if (existingFilePath) {
				// Handle existing file with modal
				const modal = new OverwriteModal(this.app);
				modal.open();
				const choice = await modal.getResult();

				return await this.handleExistingFile(
					choice,
					existingFilePath,
					targetPath,
					content
				);
			} else {
				// Save new file
				await fs.writeFile(targetPath, content, "utf8");
				return targetPath;
			}
		} catch (error) {
			console.error("Error processing file:", error);
			new Notice("An error occurred while processing the file.");
			return null;
		}
	}

	private async processLinks(content: string): Promise<string> {
		try {
			const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"];
			const lines = content.split("\n");
			let processedContent = "";
	
			// 판단 함수
			const determineLineType = (line: string): string => {
				if (/\[[^\]]*\]\([^)]*\)/.test(line)) {
					return "mdLink";
				} else if (/^\[\[.*?\]\]$/.test(line) && !line.includes("http")) {
					return "obsidianLink";
				} else if (/^!\[\[.*?\]\]$/.test(line)) {
					return "obsidianImage";
				}
				return "other";
			};
	
			for (const line of lines) {
				const lineType = determineLineType(line);

				switch (lineType) {
					case "mdLink":
						// 이미 MD 문법에 맞는 링크는 그대로 추가
						processedContent += `${line}\n`;
						break;
	
					case "obsidianLink":
						// 옵시디안 형식의 텍스트 링크를 MD 형식으로 변환
						// Example: [[Page Name|Custom Title]] -> [Custom Title](page-name)
						processedContent += line.replace(/\[\[(.*?)\]\]/g, (match, link) => {
							const parts = link.split("|");
							const title = parts[1] || parts[0];
							const url = parts[0].toLowerCase().replace(/ /g, "-");
	
							// HTTP로 시작하거나 빈 URL은 그대로 둔다
							if (url.startsWith("http") || !url) {
								return match;
							}
	
							return `[${title}](${url})`;
						}) + "\n";
						break;
	
					case "obsidianImage":
						// 옵시디안 형식의 이미지 링크를 Jekyll 마크다운 엔진 형식으로 변환
						// Example: ![[image.png|100]] -> ![](image.png){:width="100px"}
						const match = line.match(/!\[\[([^\]|]+)(?:\|(\d+))?\]\]/);
						if (match) {
							const [, imageName, width] = match;
							if (imageName.startsWith("http")) {
								processedContent += width
									? `![](${imageName}){:width="${width}px"}\n`
									: `![](${imageName})\n`;
							} else if (imageExtensions.some(ext => imageName.toLowerCase().endsWith(ext))) {
								const allFiles = this.app.vault.getFiles();
								const imageFile = allFiles.find(f => f.path.endsWith(imageName));
	
								if (imageFile) {
									try {
										const imageData = await this.app.vault.readBinary(imageFile);
										const sanitizedImageName = path.basename(imageName).toLowerCase().replace(/\s+/g, "-");
										const targetImagePath = path.join(
											this.settings.activeTargetFolder,
											this.settings.imageFolder,
											sanitizedImageName
										);
	
										await fs.mkdir(path.dirname(targetImagePath), { recursive: true });
										await fs.writeFile(targetImagePath, Buffer.from(imageData));
	
										const newImagePath = path.join(this.settings.imageFolder, sanitizedImageName);
										processedContent += width
											? `![](${newImagePath}){:width="${width}px"}\n`
											: `![](${newImagePath})\n`;
									} catch (error) {
										console.error(`이미지 처리 중 에러 발생: ${error}`);
										new Notice(`이미지 처리 중 에러가 발생했습니다: ${imageName}`);
									}
								}
							}
						}
						break;
	
					default:
						// 다른 내용은 그대로 추가
						processedContent += `${line}\n`;
						break;
				}
			}
	
			return processedContent.trim();
		} catch (error) {
			console.error("링크 처리 중 에러 발생:", error);
			return content; // 오류 발생 시 원본 콘텐츠 반환
		}
	}
	
	

	/**
	 * Adds front matter template if not present.
	 */
	private async processFrontMatter(
		content: string,
		filePath: string
	): Promise<string> {
		const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
		const hasFrontMatter = frontMatterRegex.test(content);

		if (!hasFrontMatter) {
			const title = path.basename(filePath, ".md");
			const date = new Date().toISOString().split("T")[0];

			// 태그 추출
			const tags = await this.extractTags(content);
			const tagsString = tags.length > 0 ? `[${tags.join(", ")}]` : "[]";

			const template = this.settings.frontMatterTemplate
				.replace("{{title}}", title)
				.replace("{{date}}", date)
				.replace("{{tags}}", tagsString); // 명확한 태그 플레이스홀더 사용

			return template + content;
		}

		return content;
	}

	/**
	 * Creates a Jekyll-formatted file name: YYYY-MM-DD-title.md
	 */
	private createJekyllFileName(file: TFile): string {
		const date = new Date().toISOString().split("T")[0];
		const title = file.basename.replace(/\s+/g, "-");
		return `${date}-${title}.md`;
	}

	/**
	 * Checks if a file with the same name already exists.
	 */
	private async findExistingFile(
		targetPostsDir: string,
		file: TFile
	): Promise<string | null> {
		try {
			const files = await fs.readdir(targetPostsDir);
			const currentTitle = file.basename.replace(/\s+/g, "-");
			const existingFile = files.find((f) => {
				const match = f.match(/^\d{4}-\d{2}-\d{2}-(.*)\.md$/);
				return match && match[1] === currentTitle;
			});
			if (existingFile) {
				return path.join(targetPostsDir, existingFile);
			}
			return null;
		} catch (error) {
			console.error("Error searching for existing file:", error);
			return null;
		}
	}

	/**
	 * Handles existing file based on user's choice.
	 */
	private async handleExistingFile(
		choice: OverwriteChoice,
		existingFilePath: string,
		targetPath: string,
		newContent: string
	): Promise<string | null> {
		switch (choice) {
			case OverwriteChoice.OverwriteDateAndContent:
				try {
					await fs.writeFile(targetPath, newContent, "utf8");
					if (existingFilePath !== targetPath) {
						await this.safeUnlink(existingFilePath);
					}
					return targetPath;
				} catch (error) {
					console.error("Error overwriting file:", error);
					new Notice("An error occurred while overwriting the file.");
					return null;
				}

			case OverwriteChoice.OverwriteContentOnly:
				return await this.overwriteContentOnly(
					existingFilePath,
					newContent
				);

			case OverwriteChoice.Cancel:
			default:
				return null;
		}
	}

	/**
	 * Safely deletes a file, preventing errors.
	 */
	private async safeUnlink(filePath: string) {
		try {
			await fs.unlink(filePath);
		} catch (error) {
			console.error("Error deleting existing file:", error);
		}
	}

	/**
	 * Overwrites only the content of the existing file, preserving front matter.
	 */
	private async overwriteContentOnly(
		existingFilePath: string,
		newContent: string
	): Promise<string> {
		try {
			const existingContent = await fs.readFile(existingFilePath, "utf8");
			const existingFrontMatterMatch = existingContent.match(
				/^---\n([\s\S]*?)\n---/
			);
			const newContentMatch = newContent.match(
				/^---\n([\s\S]*?)\n---\n([\s\S]*)$/
			);

			if (existingFrontMatterMatch && newContentMatch) {
				const newBodyContent = newContentMatch[2];
				const updatedContent = `${existingFrontMatterMatch[0]}\n${newBodyContent}`;
				await fs.writeFile(existingFilePath, updatedContent, "utf8");
			} else {
				// If front matter pattern doesn't match, overwrite entirely
				await fs.writeFile(existingFilePath, newContent, "utf8");
			}

			return existingFilePath;
		} catch (error) {
			console.error("Error overwriting content:", error);
			new Notice("An error occurred while overwriting content.");
			return existingFilePath;
		}
	}

	// Constants 섹션에 추가
	TAG_EXTRACTION_PROMPT = `
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

	// JekyllExporter 클래스 내에 새로운 메소드 추가
	private async extractTags(content: string): Promise<string[]> {
		// useAutoTags가 false면 빈 배열 반환
		if (!this.settings.useAutoTags) {
			return [];
		}

		if (!this.settings.openaiApiKey) {
			console.log("OpenAI API key not configured");
			return [];
		}

		try {
			const response = await fetch(
				`${this.settings.openaiApiBaseUrl}/chat/completions`,
				{
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
								content:
									"You are a tag extraction assistant. Extract relevant tags from the given content.",
							},
							{
								role: "user",
								content: this.TAG_EXTRACTION_PROMPT + content,
							},
						],
						temperature: 0.3,
						max_tokens: 100,
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data = await response.json();
			const tagString = data.choices[0].message.content.trim();

			// 콤마로 구분된 태그를 배열로 변환하고 정리
			const tags = tagString
				.split(",")
				.map((tag: string) => tag.trim().toLowerCase())
				.filter((tag: string) => tag) // 빈 태그 제거
				.slice(0, 10); // 최대 10개로 제한

			return tags;
		} catch (error) {
			console.error("Error extracting tags:", error);
			return [];
		}
	}
}

// ========================= Settings Tab =========================

// Plugin settings tab
class JekyllExportSettingTab extends PluginSettingTab {
	plugin: JekyllExportPlugin;
	newFolderInput!: TextComponent;

	constructor(app: App, plugin: JekyllExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Display the settings UI
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 최상위 컨테이너에 플러그인 전용 클래스 추가
		containerEl.addClass("jekyll-export-plugin");
		containerEl.addClass("jekyll-settings-container");

		// 타겟 폴더 섹션
		const targetSection = containerEl.createDiv("jekyll-settings-section");
		targetSection.createEl("h2", { text: "Target Folders" });

		const foldersContainer = targetSection.createDiv("folders-container");

		// 기존 폴더 목록 표시
		this.plugin.settings.targetFolders.forEach((folder, index) => {
			const folderDiv = foldersContainer.createDiv("folder-item");

			folderDiv.createSpan({
				text: folder,
				cls: "folder-path",
			});

			new ButtonComponent(folderDiv)
				.setButtonText(BUTTON_DELETE)
				.setClass("jekyll-button")
				.setClass("danger")
				.onClick(async () => {
					this.plugin.settings.targetFolders.splice(index, 1);
					if (this.plugin.settings.activeTargetFolder === folder) {
						this.plugin.settings.activeTargetFolder =
							this.plugin.settings.targetFolders[0] || "";
					}
					await this.plugin.saveSettings();
					this.display();
				});
		});

		// 새 폴더 추가 설정
		new Setting(targetSection)
			.setName("Add New Target Folder")
			.setDesc("Jekyll site root path (e.g., /path/to/jekyll/site)")
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
						if (
							value &&
							!this.plugin.settings.targetFolders.includes(value)
						) {
							try {
								// Validate folder path
								await fs.access(value);
								this.plugin.settings.targetFolders.push(value);
								// Activate the first added folder
								if (
									this.plugin.settings.targetFolders
										.length === 1
								) {
									this.plugin.settings.activeTargetFolder =
										value;
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

		// 활성 폴더 선택 섹션
		const activeSection = containerEl.createDiv("jekyll-settings-section");
		activeSection.createEl("h2", { text: "Active Target Folder" });

		new Setting(activeSection)
			.setName("Select Active Folder")
			.setDesc("Choose the active target folder for exports.")
			.addDropdown((dropdown) => {
				this.plugin.settings.targetFolders.forEach((folder) => {
					dropdown.addOption(folder, folder);
				});
				dropdown.setValue(
					this.plugin.settings.activeTargetFolder || ""
				);
				dropdown.selectEl.addClass("folder-select");
				dropdown.onChange(async (value) => {
					// Validate selected folder
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

		// Front Matter 섹션
		const frontMatterSection = containerEl.createDiv(
			"jekyll-settings-section"
		);
		frontMatterSection.createEl("h2", { text: "Front Matter Settings" });

		new Setting(frontMatterSection)
			.setName("Front Matter Template")
			.setDesc("Default Front Matter template for new documents")
			.addTextArea((text) => {
				text.inputEl.addClass("front-matter-textarea");
				text.setPlaceholder(DEFAULT_FRONT_MATTER_TEMPLATE)
					.setValue(this.plugin.settings.frontMatterTemplate)
					.onChange(async (value: string) => {
						this.plugin.settings.frontMatterTemplate = value;
						await this.plugin.saveSettings();
					});
			});

		// 이미지 설정 섹션
		const imageSection = containerEl.createDiv("jekyll-settings-section");
		imageSection.createEl("h2", { text: "Image Settings" });

		new Setting(imageSection)
			.setName("Image Folder")
			.setDesc("Image storage path in Jekyll site")
			.addText((text) => {
				text.setPlaceholder("assets/img")
					.setValue(this.plugin.settings.imageFolder)
					.onChange(async (value) => {
						this.plugin.settings.imageFolder = value.trim();
						await this.plugin.saveSettings();
					});
			});

		// OpenAI 설정 섹션
		const openaiSection = containerEl.createDiv("jekyll-settings-section");
		openaiSection.createEl("h2", { text: "OpenAI Settings" });

		new Setting(openaiSection)
			.setName("API Base URL")
			.setDesc("OpenAI API base URL")
			.addText((text) => {
				text.setValue(this.plugin.settings.openaiApiBaseUrl)
					.setPlaceholder("https://api.openai.com/v1")
					.onChange(async (value) => {
						this.plugin.settings.openaiApiBaseUrl = value.trim();
						await this.plugin.saveSettings();
					});
			});

		// OpenAI 모델 상수 추가
		const OPENAI_MODELS = [
			"gpt-4",
			"gpt-4o-mini",
			"gpt-4-turbo",
			"gpt-3.5-turbo",
			"custom",
		];

		let customModelInput: TextComponent;

		new Setting(openaiSection)
			.setName("Model")
			.setDesc("Select OpenAI model or enter custom model name")
			.addDropdown((dropdown) => {
				OPENAI_MODELS.forEach((model) => {
					dropdown.addOption(model, model);
				});
				const currentModel = this.plugin.settings.openaiModel;
				// 현재 설정된 모델이 기본 목록에 없으면 custom 선택
				const value = OPENAI_MODELS.includes(currentModel)
					? currentModel
					: "custom";
				dropdown.setValue(value);
				dropdown.onChange(async (value) => {
					if (value === "custom") {
						customModelInput.inputEl.style.display = "block";
					} else {
						customModelInput.inputEl.style.display = "none";
						this.plugin.settings.openaiModel = value;
						await this.plugin.saveSettings();
					}
				});
			})
			.addText((text) => {
				customModelInput = text;
				text.setPlaceholder("Enter custom model name")
					.setValue(
						OPENAI_MODELS.includes(this.plugin.settings.openaiModel)
							? ""
							: this.plugin.settings.openaiModel
					)
					.onChange(async (value) => {
						if (value) {
							this.plugin.settings.openaiModel = value.trim();
							await this.plugin.saveSettings();
						}
					});
				// 초기 상태 설정
				text.inputEl.style.display = OPENAI_MODELS.includes(
					this.plugin.settings.openaiModel
				)
					? "none"
					: "block";
			});

		new Setting(openaiSection)
			.setName("API Key")
			.setDesc("Your OpenAI API key")
			.addText((text) => {
				text
					.setValue(this.plugin.settings.openaiApiKey)
					.setPlaceholder("sk-...").inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			});

		// 테스트 버튼 추가
		new Setting(openaiSection)
			.setName("Test API Connection")
			.setDesc("Test your OpenAI API connection")
			.addButton((button) => {
				button
					.setButtonText("Test Connection")
					.setClass("jekyll-button")
					.onClick(async () => {
						try {
							const response = await fetch(
								`${this.plugin.settings.openaiApiBaseUrl}/chat/completions`,
								{
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
												content:
													"Hello! This is a test message.",
											},
										],
									}),
								}
							);

							if (response.ok) {
								new Notice("API connection successful!");
							} else {
								const error = await response.json();
								new Notice(
									`API connection failed: ${
										error.error?.message || "Unknown error"
									}`
								);
							}
						} catch (error) {
							new Notice(
								`API connection failed: ${error.message}`
							);
						}
					});
			});

		new Setting(openaiSection)
			.setName("Auto Tag Generation")
			.setDesc(
				"Automatically generate tags using OpenAI when no tags are present"
			)
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.useAutoTags)
					.onChange(async (value) => {
						this.plugin.settings.useAutoTags = value;
						await this.plugin.saveSettings();
					});
			});
	}
}

// ========================= Plugin Class =========================

// Main plugin class
export default class JekyllExportPlugin extends Plugin {
	settings: JekyllExportSettings;
	private exporter!: JekyllExporter;

	async onload() {
		// CSS 스타일 주입
		injectStyles(MODAL_CSS);
		injectStyles(SETTINGS_CSS); // 새로운 CSS 추가

		// Load settings
		await this.loadSettings();
		this.exporter = new JekyllExporter(this.app, this.settings);

		// Add ribbon icon: Export active markdown file to Jekyll
		this.addRibbonIcon(ICON_UPLOAD, "Export to Jekyll", () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile && activeFile.extension === "md") {
				this.exportToJekyll(activeFile);
			} else {
				new Notice("No markdown file is open.");
			}
		});

		// Add file context menu: Right-click -> Export to Jekyll
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFile && file.extension === "md") {
					menu.addItem((item) => {
						item.setTitle(BUTTON_EXPORT)
							.setIcon(ICON_UPLOAD)
							.onClick(() => this.exportToJekyll(file as TFile));
					});
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new JekyllExportSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = { ...DEFAULT_SETTINGS, ...data };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Method to trigger export
	async exportToJekyll(file: TFile) {
		try {
			const targetPath = await this.exporter.exportFile(file);

			// If export was canceled or errored
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
