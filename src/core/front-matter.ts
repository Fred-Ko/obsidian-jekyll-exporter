import * as yaml from "yaml";
import type { FrontMatter, ParsedMarkdown } from "../domain/types";
import { ExportError, errorMessage } from "./errors";

const FRONT_MATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const PLACEHOLDER_PATTERN = /\{\{[a-zA-Z][a-zA-Z0-9_-]*\}\}/g;

export function parseMarkdown(markdown: string): ParsedMarkdown {
	const match = markdown.match(FRONT_MATTER_PATTERN);
	if (!match) return { frontMatter: {}, body: markdown };

	try {
		const parsed = yaml.parse(match[1] ?? "");
		if (parsed === null || parsed === undefined) {
			return { frontMatter: {}, body: markdown.slice(match[0].length) };
		}
		if (!isPlainObject(parsed)) {
			throw new ExportError("Front Matter의 최상위 값은 객체여야 합니다.");
		}
		return {
			frontMatter: parsed,
			body: markdown.slice(match[0].length),
		};
	} catch (error) {
		if (error instanceof ExportError) throw error;
		throw new ExportError(`Front Matter YAML을 해석할 수 없습니다: ${errorMessage(error)}`, error);
	}
}

export function stringifyMarkdown(frontMatter: FrontMatter, body: string): string {
	return `---\n${yaml.stringify(frontMatter, { lineWidth: 0 })}---\n${body}`;
}

export function applyFrontMatterTemplate(
	template: string,
	original: FrontMatter,
	title: string,
	now: Date = new Date(),
): FrontMatter {
	const source = stripDelimiters(template);
	if (!source.trim()) return { ...original };

	const values: Record<string, string> = {
		"{{title}}": yaml.stringify(title).trimEnd(),
		"{{date}}": yaml.stringify(now.toISOString().slice(0, 10)).trimEnd(),
		"{{datetime}}": yaml.stringify(now.toISOString()).trimEnd(),
	};

	let rendered = source;
	for (const [placeholder, value] of Object.entries(values)) {
		rendered = rendered.replaceAll(placeholder, value);
	}
	rendered = rendered.replace(PLACEHOLDER_PATTERN, "null");

	try {
		const parsed = yaml.parse(rendered);
		if (parsed === null || parsed === undefined) return { ...original };
		if (!isPlainObject(parsed)) {
			throw new ExportError("Front Matter 템플릿의 최상위 값은 객체여야 합니다.");
		}

		return {
			...removeNullTemplateValues(parsed),
			...original,
		};
	} catch (error) {
		if (error instanceof ExportError) throw error;
		throw new ExportError(`Front Matter 템플릿이 유효한 YAML이 아닙니다: ${errorMessage(error)}`, error);
	}
}

function stripDelimiters(template: string): string {
	const normalized = template.replaceAll("\r\n", "\n").trim();
	if (!normalized.startsWith("---")) return normalized;
	return normalized.replace(/^---[ \t]*\n/, "").replace(/\n---[ \t]*$/, "");
}

function isPlainObject(value: unknown): value is FrontMatter {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function removeNullTemplateValues(frontMatter: FrontMatter): FrontMatter {
	return Object.fromEntries(Object.entries(frontMatter).filter(([, value]) => value !== null));
}
