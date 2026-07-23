import { customAlphabet } from "nanoid";
import path from "node:path";
import type { FrontMatter } from "../domain/types";
import { PermalinkStyle } from "../domain/types";
import { ExportError } from "./errors";

const createNanoId = customAlphabet("123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ", 25);

export function reconcileNanoId(source: FrontMatter, published?: FrontMatter): string {
	const sourceId = readOptionalString(source.nanoId, "원본 노트의 nanoId");
	const publishedId = readOptionalString(published?.nanoId, "기존 발행본의 nanoId");
	const nanoId = publishedId ?? sourceId ?? createNanoId();
	source.nanoId = nanoId;
	return nanoId;
}

export function applyPermalink(
	frontMatter: FrontMatter,
	style: PermalinkStyle,
	postFileName: string,
): FrontMatter {
	switch (style) {
		case PermalinkStyle.None:
			return frontMatter;
		case PermalinkStyle.NanoId:
			frontMatter.permalink = `/${readRequiredString(frontMatter.nanoId, "nanoId")}/`;
			return frontMatter;
		case PermalinkStyle.FileNameUrlEncoded:
			frontMatter.permalink = `/${encodeURIComponent(postFileName)}/`;
			return frontMatter;
		case PermalinkStyle.FileNameNoUrlEncoding:
			frontMatter.permalink = `/${path.basename(postFileName, path.extname(postFileName))}/`;
			return frontMatter;
	}
}

function readOptionalString(value: unknown, label: string): string | undefined {
	if (value === undefined) return undefined;
	if (typeof value !== "string" || !value.trim()) {
		throw new ExportError(`${label} 값이 문자열이 아닙니다.`);
	}
	return value.trim();
}

function readRequiredString(value: unknown, label: string): string {
	const result = readOptionalString(value, label);
	if (!result) throw new ExportError(`${label} 값이 없습니다.`);
	return result;
}
