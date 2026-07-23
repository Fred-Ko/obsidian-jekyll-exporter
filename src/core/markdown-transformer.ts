import { wikiLinkToHref } from "./file-names";

export interface AssetPublisher {
	publish(reference: string): Promise<string | null>;
}

const WIKI_IMAGE_PATTERN = /!\[\[([^|\]]+)(?:\|(\d+))?\]\]/g;
const MARKDOWN_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\n]+)\)(?:\{:width="(\d+)px"\})?/g;
const INLINE_CODE_PATTERN = /(`+[^`]*?`+)/g;

export async function transformMarkdown(markdown: string, assets: AssetPublisher): Promise<string> {
	const lines = markdown.split("\n");
	let fence: { marker: string; length: number } | null = null;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";
		const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

		if (fenceMatch?.[1]) {
			const marker = fenceMatch[1][0] ?? "`";
			const length = fenceMatch[1].length;
			if (!fence) {
				fence = { marker, length };
			} else if (marker === fence.marker && length >= fence.length) {
				fence = null;
			}
			continue;
		}

		if (fence) continue;
		lines[index] = await transformOutsideInlineCode(line, assets);
	}

	return lines.join("\n");
}

async function transformOutsideInlineCode(line: string, assets: AssetPublisher): Promise<string> {
	const parts = line.split(INLINE_CODE_PATTERN);
	for (let index = 0; index < parts.length; index += 1) {
		const part = parts[index] ?? "";
		if (part.startsWith("`")) continue;
		parts[index] = await transformText(part, assets);
	}
	return parts.join("");
}

async function transformText(text: string, assets: AssetPublisher): Promise<string> {
	let transformed = await replaceAsync(text, MARKDOWN_IMAGE_PATTERN, async (match) => {
		const alt = match[1] ?? "";
		const rawReference = (match[2] ?? "").trim();
		const width = match[3];
		const reference = rawReference.replace(/^<|>$/g, "");

		if (isExternalUrl(reference) || reference.startsWith("data:")) {
			return match[0];
		}

		const publishedPath = await assets.publish(reference);
		return publishedPath ? imageMarkup(alt, publishedPath, width) : match[0];
	});

	transformed = await replaceAsync(transformed, WIKI_IMAGE_PATTERN, async (match) => {
		const reference = match[1] ?? "";
		const width = match[2];

		if (isExternalUrl(reference)) {
			return imageMarkup("", reference, width);
		}

		const publishedPath = await assets.publish(reference);
		return publishedPath ? imageMarkup("", publishedPath, width) : match[0];
	});

	return transformWikiLinks(transformed);
}

function transformWikiLinks(text: string): string {
	let transformed = text.replace(
		/(^|[^!])\[\[([^|\]]+)\|([^\]]+)\]\]/g,
		(_match, prefix: string, target: string, label: string) =>
			`${prefix}[${label}](${wikiLinkToHref(target)})`,
	);
	transformed = transformed.replace(
		/(^|[^!])\[\[([^\]]+)\]\]/g,
		(_match, prefix: string, target: string) => `${prefix}[${target}](${wikiLinkToHref(target)})`,
	);
	return transformed;
}

function imageMarkup(alt: string, url: string, width?: string): string {
	const image = `![${alt}](${url})`;
	return width ? `${image}{:width="${width}px"}` : image;
}

function isExternalUrl(value: string): boolean {
	return /^https?:\/\//i.test(value);
}

async function replaceAsync(
	input: string,
	pattern: RegExp,
	replacer: (match: RegExpExecArray) => Promise<string>,
): Promise<string> {
	let output = "";
	let cursor = 0;
	pattern.lastIndex = 0;

	for (let match = pattern.exec(input); match; match = pattern.exec(input)) {
		output += input.slice(cursor, match.index);
		output += await replacer(match);
		cursor = match.index + match[0].length;
	}

	return output + input.slice(cursor);
}
