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
	"---\ntitle: {{title}}\ndate: {{date}}\ntags: []\n---\n";

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
	attachmentSearchMode: "obsidian" | "current" | "subfolder" | "custom";
	customAttachmentFolder: string;
	activeTargetFolder: string;
}

// ========================= Default Settings =========================

const DEFAULT_SETTINGS: JekyllExportSettings = {
	targetFolders: [],
	excludePatterns: [],
	frontMatterTemplate: DEFAULT_FRONT_MATTER_TEMPLATE,
	imageFolder: "assets/images",
	attachmentSearchMode: "obsidian",
	customAttachmentFolder: "",
	activeTargetFolder: "",
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
			content = this.processFrontMatter(content, file.path);

			// Convert wiki links to markdown links
			content = this.convertWikiLinks(content);

			// Convert image links
			content = this.processImageLinks(content);

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

	/**
	 * Adds front matter template if not present.
	 */
	private processFrontMatter(content: string, filePath: string): string {
		const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
		const hasFrontMatter = frontMatterRegex.test(content);

		if (!hasFrontMatter) {
			const title = path.basename(filePath, ".md");
			const date = new Date().toISOString().split("T")[0];
			const template = this.settings.frontMatterTemplate
				.replace("{{title}}", title)
				.replace("{{date}}", date);
			return template + content;
		}

		return content;
	}

	/**
	 * Converts [[Wiki Links]] to standard Markdown links.
	 */
	private convertWikiLinks(content: string): string {
		return content.replace(/\[\[(.*?)\]\]/g, (match, link) => {
			const parts = link.split("|");
			const title = parts[1] || parts[0];
			const url = parts[0].toLowerCase().replace(/ /g, "-");
			return `[${title}](${url})`;
		});
	}

	/**
	 * Converts ![[Image]] to standard Markdown image links.
	 */
	private processImageLinks(content: string): string {
		return content.replace(/!\[\[(.*?)\]\]/g, (match, image) => {
			const imagePath = `/${this.settings.imageFolder}/${image}`;
			return `![${image}](${imagePath})`;
		});
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

		containerEl.createEl("h2", { text: "Basic Settings" });

		// Target Folders setting
		containerEl.createEl("h3", { text: "Target Folders" });
		const foldersContainer = containerEl.createDiv("folders-container");

		this.plugin.settings.targetFolders.forEach((folder, index) => {
			const folderDiv = foldersContainer.createDiv("folder-item");

			const folderSpan = folderDiv.createSpan({ text: folder });
			folderSpan.style.marginRight = "8px";

			new ButtonComponent(folderDiv)
				.setButtonText(BUTTON_DELETE)
				.onClick(async () => {
					this.plugin.settings.targetFolders.splice(index, 1);
					// Replace active folder if deleted
					if (this.plugin.settings.activeTargetFolder === folder) {
						this.plugin.settings.activeTargetFolder =
							this.plugin.settings.targetFolders[0] || "";
					}
					await this.plugin.saveSettings();
					this.display();
				});
		});

		// Add new folder
		new Setting(containerEl)
			.setName("Add New Target Folder")
			.setDesc("Jekyll site root path (e.g., /path/to/jekyll/site)")
			.addText((text) => {
				this.newFolderInput = text;
				text.setPlaceholder("/path/to/jekyll/site");
			})
			.addButton((button) => {
				button.setButtonText(BUTTON_ADD).onClick(async () => {
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
								this.plugin.settings.targetFolders.length === 1
							) {
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

		// Active Target Folder selection
		containerEl.createEl("h3", { text: "Active Target Folder" });
		new Setting(containerEl)
			.setName("Select Active Folder")
			.setDesc("Choose the active target folder for exports.")
			.addDropdown((dropdown) => {
				this.plugin.settings.targetFolders.forEach((folder) => {
					dropdown.addOption(folder, folder);
				});
				dropdown.setValue(
					this.plugin.settings.activeTargetFolder || ""
				);
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

		// Front Matter settings
		containerEl.createEl("h2", { text: "Front Matter Settings" });
		new Setting(containerEl)
			.setName("Front Matter Template")
			.setDesc("Default Front Matter template for new documents")
			.addTextArea((text) =>
				text
					.setPlaceholder(DEFAULT_FRONT_MATTER_TEMPLATE)
					.setValue(this.plugin.settings.frontMatterTemplate)
					.onChange(async (value) => {
						this.plugin.settings.frontMatterTemplate = value;
						await this.plugin.saveSettings();
					})
			);

		// Image folder settings
		containerEl.createEl("h2", { text: "Image Settings" });
		new Setting(containerEl)
			.setName("Image Folder")
			.setDesc("Image storage path in Jekyll site")
			.addText((text) =>
				text
					.setPlaceholder("assets/images")
					.setValue(this.plugin.settings.imageFolder)
					.onChange(async (value) => {
						this.plugin.settings.imageFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}

// ========================= Plugin Class =========================

// Main plugin class
export default class JekyllExportPlugin extends Plugin {
	settings: JekyllExportSettings;
	private exporter!: JekyllExporter;

	async onload() {
		// Inject CSS styles
		injectStyles(MODAL_CSS);

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
