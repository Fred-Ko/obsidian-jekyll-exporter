import { randomUUID } from "node:crypto";
import type { FrontMatter } from "../domain/types";
import { ExportError } from "./errors";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readPostId(frontMatter: FrontMatter | undefined, label: string): string | undefined {
	const value = frontMatter?.post_id;
	if (value === undefined) return undefined;

	if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
		throw new ExportError(`${label}의 post_id가 유효한 UUID가 아닙니다.`);
	}

	return value.trim().toLowerCase();
}

export function reconcilePostId(
	source: FrontMatter,
	published?: FrontMatter,
	createId: () => string = randomUUID,
): string {
	const sourcePostId = readPostId(source, "원본 노트");
	const publishedPostId = readPostId(published, "기존 발행본");

	if (sourcePostId && publishedPostId && sourcePostId !== publishedPostId) {
		throw new ExportError(
			`원본 노트와 기존 발행본의 post_id가 다릅니다. 원본: ${sourcePostId}, 발행본: ${publishedPostId}`,
		);
	}

	const postId = sourcePostId ?? publishedPostId ?? createId().toLowerCase();
	if (!UUID_PATTERN.test(postId)) {
		throw new ExportError("생성된 post_id가 유효한 UUID가 아닙니다.");
	}

	source.post_id = postId;
	return postId;
}
