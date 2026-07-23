import path from "node:path";

const DATE_PREFIX_PATTERN = /^\d{4}-\d{2}-\d{2}-/;

export function sanitizeFileName(fileName: string): string {
	return fileName
		.normalize("NFC")
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/([!@#$%^&*()_+\-=])\1+/g, "$1");
}

export function toPostFileName(fileName: string): string {
	return sanitizeFileName(path.basename(fileName)).replaceAll("-", "+");
}

export function toDatedPostFileName(postFileName: string, isoDate: string): string {
	return `${isoDate}-${postFileName}`;
}

export function isMatchingPublishedPost(candidate: string, postFileName: string): boolean {
	return candidate.endsWith(".md") && candidate.replace(DATE_PREFIX_PATTERN, "") === postFileName;
}

export function sanitizeAssetFileName(reference: string): string {
	const decoded = safeDecodeURIComponent(reference);
	const baseName = path.posix.basename(decoded.replaceAll("\\", "/"));
	const sanitized = sanitizeFileName(baseName).replace(/[^\p{L}\p{N}._+-]/gu, "-");
	return sanitized.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function wikiLinkToHref(target: string): string {
	const [page = "", ...fragments] = target.split("#");
	const slug = sanitizeFileName(page.trim());
	const fragment = fragments.join("#").trim();
	return fragment ? `${slug}#${encodeURIComponent(fragment)}` : slug;
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
