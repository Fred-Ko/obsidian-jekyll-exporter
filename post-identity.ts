import { randomUUID } from "crypto";

type FrontMatter = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readPostId(frontMatter: FrontMatter | undefined, label: string): string | undefined {
	const value = frontMatter?.post_id;

	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== "string" || !UUID_PATTERN.test(value.trim())) {
		throw new Error(`${label}의 post_id가 유효한 UUID가 아닙니다.`);
	}

	return value.trim().toLowerCase();
}

/**
 * 원본 노트와 이미 발행된 글이 동일한 post_id를 계속 사용하도록 보장한다.
 *
 * - 양쪽에 ID가 없으면 새 UUID를 생성한다.
 * - 한쪽에만 ID가 있으면 그 값을 사용한다.
 * - 양쪽 ID가 다르면 잘못된 글에 덮어쓰는 일을 막기 위해 중단한다.
 */
export function reconcilePostId(source: FrontMatter, published?: FrontMatter): string {
	const sourcePostId = readPostId(source, "원본 노트");
	const publishedPostId = readPostId(published, "기존 발행본");

	if (sourcePostId && publishedPostId && sourcePostId !== publishedPostId) {
		throw new Error(
			`원본 노트와 기존 발행본의 post_id가 다릅니다. 원본: ${sourcePostId}, 발행본: ${publishedPostId}`
		);
	}

	const postId = sourcePostId ?? publishedPostId ?? randomUUID();
	source.post_id = postId;

	return postId;
}
