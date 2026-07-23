import { ButtonComponent, Modal } from "obsidian";
import type { App } from "obsidian";
import type { OverwritePrompter } from "../application/export-post";
import { OverwriteChoice } from "../domain/types";

export class OverwriteModal extends Modal implements OverwritePrompter {
	private resolveChoice: ((choice: OverwriteChoice) => void) | null = null;

	constructor(app: App) {
		super(app);
	}

	choose(): Promise<OverwriteChoice> {
		return new Promise((resolve) => {
			this.resolveChoice = resolve;
			this.open();
		});
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("jekyll-overwrite-modal");
		contentEl.createEl("h2", { text: "이미 발행된 글이 있습니다" });
		contentEl.createEl("p", {
			text: "이번 발행에서 변경할 범위를 선택하세요.",
			cls: "jekyll-overwrite-description",
		});

		const buttons = contentEl.createDiv("jekyll-overwrite-actions");
		this.addButton(buttons, "Front Matter와 본문", OverwriteChoice.Full, true);
		this.addButton(buttons, "본문만", OverwriteChoice.ContentOnly);
		this.addButton(buttons, "Front Matter만", OverwriteChoice.FrontMatterOnly);
		this.addButton(buttons, "취소", OverwriteChoice.Cancel);
	}

	override onClose(): void {
		this.contentEl.empty();
		this.settle(OverwriteChoice.Cancel);
	}

	private addButton(container: HTMLElement, label: string, choice: OverwriteChoice, primary = false): void {
		const button = new ButtonComponent(container).setButtonText(label);
		if (primary) button.setCta();
		button.onClick(() => {
			this.settle(choice);
			this.close();
		});
	}

	private settle(choice: OverwriteChoice): void {
		const resolve = this.resolveChoice;
		this.resolveChoice = null;
		resolve?.(choice);
	}
}
