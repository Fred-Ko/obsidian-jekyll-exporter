import * as fs from "fs/promises";
import { customAlphabet } from "nanoid";
import { App, ButtonComponent, FileSystemAdapter, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent, TFile } from "obsidian";
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
						frontMatter[key] = this.frontMatterProcessor[value](file.name.replace(/\.md$/i, ""));
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
		/*
			obsidianLinkToMarkdown 함수는 Obsidian 형식의 링크와 이미지를 포함한 텍스트 콘텐츠를 받아,
			이를 Markdown 형식으로 변환하여 반환합니다.

			- 콘텐츠는 여러 줄로 구성될 수 있으며, 각 줄은 개별적으로 처리됩니다.
			- Obsidian 이미지 구문(![[이미지이름|크기]] 또는 ![[이미지이름]])을 탐지하여 적절한 Markdown 이미지 구문으로 변환합니다.
				- 외부 이미지(HTTP로 시작하는 경우)는 직접 Markdown 이미지로 변환됩니다.
					- **불변식:**
						- 외부 이미지 URL은 유효한 HTTP/HTTPS 프로토콜을 사용해야 합니다.
						- 변환된 Markdown 이미지 구문은 `![](URL)` 또는 `![](URL){:width="크기px"}` 형태를 유지해야 합니다.
				- 내부 이미지인 경우, 이미지 파일을 지정된 폴더로 복사하고 해당 경로를 사용하여 Markdown 이미지로 변환됩니다.
					- **불변식:**
						- 내부 이미지 파일명은 소문자로 변환되고, 공백은 하이픈(`-`)으로 대체됩니다.
						- 지정된 대상 폴더(`this.settings.activeTargetFolder + this.settings.imageFolder`)에 이미지 파일이 정확히 복사되어야 합니다.
						- 복사된 이미지 파일의 경로는 `images/파일명` 형태로 설정됩니다.
						- 원본 이미지 파일이 존재하지 않으면, 변환이 수행되지 않고 원본 줄이 그대로 유지됩니다.
						- 이미지 크기가 지정된 경우, 변환된 Markdown 이미지 구문에 `{ :width="크기px" }` 속성이 포함되어야 합니다.
						- 이미지 복사 과정에서 에러가 발생하면, 에러가 로그에 기록되고 원본 줄이 그대로 유지됩니다.
				- 이미지 크기가 지정된 경우, Markdown 이미지 구문에 크기 속성이 반영됩니다.
				- 이미지 크기가 지정되지 않은 경우, 크기 속성 없이 Markdown 이미지로 변환됩니다.
			- Obsidian 링크 구문([[링크|표시이름]] 또는 [[링크]])을 탐지하여 Markdown 링크 구문([표시이름](url))으로 변환합니다.
				- **불변식:**
					- 링크 대상이 URL 형식이 아닌 경우에만 변환이 수행됩니다.
					- 링크 대상의 공백은 하이픈(`-`)으로 대체되고, 모든 문자는 소문자로 변환됩니다.
					- 허용되지 않는 문자는 제거되며, 결과 URL은 알파벳 소문자, 숫자, 하이픈만 포함해야 합니다.
					- 변환된 Markdown 링크 구문은 `[표시이름](url)` 형태를 유지해야 합니다.
					- 링크 대상이 유효하지 않거나 외부 링크인 경우, 변환을 생략하고 원본 링크를 유지합니다.
			- 변환 과정에서 발생할 수 있는 오류는 적절히 처리되어, 최종 반환되는 Markdown 콘텐츠가 일관성을 유지하도록 합니다.
				- **불변식:**
					- 모든 예외 상황은 로그에 기록되어야 합니다.
					- 사용자에게 알림(`Notice`)이 적절히 제공되어야 합니다.
					- 예외 발생 시, 해당 줄은 원본 상태로 유지됩니다.
			- 모든 변환 작업은 비동기적으로 수행되어, 효율적인 파일 I/O 및 네트워크 요청을 관리합니다.
				- **불변식:**
					- 비동기 작업은 `await`를 사용하여 올바르게 처리되어야 합니다.
					- 비동기 작업 중 발생하는 모든 프로미스는 적절히 처리되어야 합니다.
			- 최종적으로 모든 줄이 변환된 후, 줄바꿈 문자를 기준으로 다시 합쳐져 최종 Markdown 문자열로 반환됩니다.
				- **불변식:**
					- 변환된 모든 줄은 원본 순서를 유지해야 합니다.
					- 줄바꿈 문자는 `\n`을 사용하여 정확히 복원되어야 합니다.
					- 최종 문자열은 앞뒤 공백이 제거된 상태여야 합니다(`trim` 사용).

			**보장 사항:**
				- 입력된 콘텐츠 내 모든 Obsidian 링크와 이미지는 정확하게 Markdown 형식으로 변환됩니다.
				- 내부 이미지의 경우, 지정된 폴더에 복사된 이미지 파일이 존재하며, 올바른 경로가 참조됩니다.
				- 외부 이미지와 링크는 원본 URL을 유지하거나 적절히 변환되어 포함됩니다.
				- 변환 과정에서 발생하는 예외는 로그에 기록되고, 사용자에게 적절히 알림이 제공됩니다.
				- 최종 반환되는 Markdown 콘텐츠는 형식적으로 올바르며, Markdown 렌더링 시 의도한 대로 표시됩니다.

			**예제:**

			1. **Obsidian 링크 변환**

				- **입력:**
					```
					이것은 [[페이지 이름|표시 이름]]과 [[다른 페이지]]에 대한 링크입니다.
					```

				- **출력:**
					```
					이것은 [표시 이름](페이지-이름)과 [다른 페이지](다른-페이지)에 대한 링크입니다.
					```

			2. **Obsidian 이미지 변환 (외부 이미지)**

				- **입력 (크기 포함):**
					```
					여기에 외부 이미지가 있습니다: ![[http://example.com/image.png|300]]
					```

				- **출력:**
					```
					여기에 외부 이미지가 있습니다: ![](http://example.com/image.png){:width="300px"}
					```

				- **입력 (크기 미포함):**
					```
					여기에 외부 이미지가 있습니다: ![[http://example.com/image.png]]
					```

				- **출력:**
					```
					여기에 외부 이미지가 있습니다: ![](http://example.com/image.png)
					```

			3. **Obsidian 이미지 변환 (내부 이미지)**

				- **입력 (크기 포함):**
					```
					내부 이미지를 추가합니다: ![[내부이미지.jpg|200]]
					```

				- **출력:**
					```
					내부 이미지를 추가합니다: ![](images/internalimage.jpg){:width="200px"}
					```
					- **설명:** `내부이미지.jpg` 파일이 지정된 폴더로 복사되고, `images/internalimage.jpg` 경로로 참조됩니다.

				- **입력 (크기 미포함):**
					```
					내부 이미지를 추가합니다: ![[내부이미지.jpg]]
					```

				- **출력:**
					```
					내부 이미지를 추가합니다: ![](images/internalimage.jpg)
					```
					- **설명:** `내부이미지.jpg` 파일이 지정된 폴더로 복사되고, `images/internalimage.jpg` 경로로 참조됩니다.

			4. **복합 예제**

				- **입력:**
					```
					이 문서에는 [[링크1]]과 [[링크2|표시2]]가 포함되어 있습니다.
					이미지는 ![[http://external.com/외부이미지.png|150]]와 ![[내부이미지.png|250]], ![[내부이미지2.png]]을 포함합니다.
					```

				- **출력:**
					```
					이 문서에는 [링크1](링크1)과 [표시2](링크2)가 포함되어 있습니다.
					이미지는 ![](http://external.com/외부이미지.png){:width="150px"}와 ![](images/internalimage.png){:width="250px"}, ![](images/internalimage2.png}을 포함합니다.
					```
					- **설명:** 
						- `내부이미지.png`와 `내부이미지2.png` 파일이 지정된 폴더로 복사되고, 각각 `images/internalimage.png` 및 `images/internalimage2.png` 경로로 참조됩니다.
						- `![[내부이미지2.png]]`는 크기 지정이 없으므로, `{ :width="..." }` 속성이 포함되지 않습니다.

			**보충 설명:**

			- **Obsidian 링크 변환:**
				- `[[링크|표시 이름]]` 형태는 `[표시 이름](링크)`로 변환됩니다.
				- `[[링크]]` 형태는 `[링크](링크)`로 변환됩니다.
				- 링크 대상이 URL 형식(`http://` 또는 `https://`)인 경우, 그대로 유지하거나 적절히 변환됩니다.

			- **Obsidian 이미지 변환:**
				- 외부 이미지는 `![[URL|크기]]` 형태에서 `![](URL){:width="크기px"}`로 변환됩니다.
				- 외부 이미지 중 크기 지정이 없는 경우, `![](URL)`로 변환됩니다.
				- 내부 이미지는 `![[파일명|크기]]` 또는 `![[파일명]]` 형태에서 지정된 폴더로 파일을 복사한 후, `![](경로){:width="크기px"}` 또는 `![](경로)`로 변환됩니다.
				- 내부 이미지 중 크기 지정이 없는 경우, `{ :width="..." }` 속성이 포함되지 않습니다.
				- 내부 이미지 파일 복사 시 다음 불변식을 준수합니다:
					- 파일명이 소문자로 변환되고, 공백이 하이픈으로 대체됩니다.
					- 지정된 대상 폴더에 이미지 파일이 정확히 복사됩니다.
					- 복사된 이미지 파일의 경로가 Markdown 이미지 구문에 올바르게 반영됩니다.
					- 이미지 파일이 존재하지 않거나 복사에 실패하면, 원본 줄이 그대로 유지됩니다.

			- **오류 처리:**
				- 변환 과정 중 파일이 존재하지 않거나 접근 권한이 없는 경우, 원본 콘텐츠을 그대로 유지하고 로그에 오류를 기록합니다.
				- 네트워크 오류 등 외부 요인으로 인한 변환 실패 시에도 원본 콘텐츠를 유지하여 일관성을 보장합니다.

			**추가 고려 사항:**
				- 비동기 작업(예: 파일 읽기/쓰기)이 포함되므로, 각 단계에서 적절한 `await` 사용을 고려해야 합니다.
				- 에러 처리를 통해 변환 과정 중 발생할 수 있는 예외 상황을 안전하게 처리해야 합니다.
				- 성능 최적화를 위해 필요 시 병렬 처리를 고려할 수 있습니다.
				- 다양한 이미지 및 링크 형식을 지원하기 위해 정규 표현식을 정교하게 설계해야 합니다.
		*/
		const lines = content.split("\n");
		const processedLines = await Promise.all(
			lines.map(async (line) => {
				// Obsidian 이미지 변환
				line = line.replace(/!\[\[(http[s]?:\/\/[^\|\]]+)(?:\|(\d+))?\]\]/g, (match, url, size) => {
					return size ? `![](${url}){:width="${size}px"}` : `![](${url})`;
				});

				const internalImageMatches = [...line.matchAll(/!\[\[([^\|\]]+)(?:\|(\d+))?\]\]/g)];
				for (const match of internalImageMatches) {
					const [fullMatch, fileName, size] = match;
					const sanitizedFileName = fileName.toLowerCase().replace(/ /g, "-");
					const targetPath = path.join(this.settings.activeTargetFolder, this.settings.imageFolder, sanitizedFileName);

					try {
						// Vault 내의 모든 파일을 검색하여 일치하는 파일 찾기
						const files = this.app.vault.getFiles();
						const matchingFile = files.find(file => file.name.toLowerCase() === fileName.toLowerCase());
		
						if (matchingFile) {
							// FileSystemAdapter를 사용하여 절대 경로 가져오기
							const adapter = this.app.vault.adapter;
							if (adapter instanceof FileSystemAdapter) {
								const basePath = adapter.getBasePath();
								const absoluteFilePath = path.join(basePath, matchingFile.path);
								console.log(`Copying file from: ${absoluteFilePath} to ${targetPath}`);
								await fs.copyFile(absoluteFilePath, targetPath);
								const replacement = size ? `![](images/${sanitizedFileName}){:width="${size}px"}` : `![](images/${sanitizedFileName})`;
								line = line.replace(fullMatch, replacement);
							} else {
								console.error("FileSystemAdapter가 아닙니다.");
							}
						} else {
							console.error(`파일을 찾을 수 없습니다: ${fileName}`);
						}
					} catch (error) {
						console.error(`이미지 복사 실패: ${error}`);
						// 원본 유지
					}
				}

				// Obsidian 링크 변환
				line = line.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, (match, link, displayName) => {
					const sanitizedLink = link
						.toLowerCase()
						.replace(/ /g, "-")
						.replace(/[^a-z0-9-]/g, "");
					return `[${displayName}](${sanitizedLink})`;
				});

				line = line.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
					const sanitizedLink = link
						.toLowerCase()
						.replace(/ /g, "-")
						.replace(/[^a-z0-9-]/g, "");
					return `[${link}](${sanitizedLink})`;
				});

				return line;
			})
		);

		return processedLines.join("\n").trim();
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
