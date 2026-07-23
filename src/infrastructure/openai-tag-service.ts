import { requestUrl, type RequestUrlParam } from "obsidian";
import { ExportError, errorMessage } from "../core/errors";
import { normalizeTags } from "../core/tags";

const TAG_PROMPT = `You are a technical blog tagging expert.
Extract 3-7 reusable, highly relevant tags.
Prefer concrete technologies, domains, concepts, and architecture patterns.
Return only a comma-separated list.`;

interface ChatCompletion {
	choices?: Array<{
		message?: {
			content?: unknown;
		};
	}>;
}

type Request = (request: RequestUrlParam | string) => ReturnType<typeof requestUrl>;

export class OpenAiTagService {
	constructor(
		private readonly baseUrl: string,
		private readonly model: string,
		private readonly apiKey: string,
		private readonly request: Request = requestUrl,
	) {}

	async extract(content: string): Promise<string[] | null> {
		const response = await this.complete([
			{ role: "system", content: TAG_PROMPT },
			{ role: "user", content },
		]);
		const raw = response.choices?.[0]?.message?.content;
		if (typeof raw !== "string") {
			throw new ExportError("태그 API 응답에 메시지 내용이 없습니다.");
		}
		return normalizeTags(raw);
	}

	async testConnection(): Promise<void> {
		await this.complete([{ role: "user", content: "Reply with OK." }]);
	}

	private async complete(messages: Array<{ role: string; content: string }>): Promise<ChatCompletion> {
		if (!this.apiKey) throw new ExportError("OpenAI API Secret을 선택해 주세요.");

		try {
			const response = await this.request({
				url: `${this.baseUrl.replace(/\/+$/, "")}/chat/completions`,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: this.model,
					messages,
					temperature: 0.2,
					max_tokens: 120,
				}),
				throw: false,
			});

			if (response.status < 200 || response.status >= 300) {
				throw new ExportError(`태그 API 요청 실패 (${response.status}): ${readApiError(response.json)}`);
			}
			return asCompletion(response.json);
		} catch (error) {
			if (error instanceof ExportError) throw error;
			throw new ExportError(`태그 API 요청 중 오류가 발생했습니다: ${errorMessage(error)}`, error);
		}
	}
}

function asCompletion(value: unknown): ChatCompletion {
	if (typeof value !== "object" || value === null) {
		throw new ExportError("태그 API 응답 형식이 올바르지 않습니다.");
	}
	return value as ChatCompletion;
}

function readApiError(value: unknown): string {
	if (typeof value !== "object" || value === null) return "알 수 없는 오류";
	const error = Reflect.get(value, "error");
	if (typeof error !== "object" || error === null) return "알 수 없는 오류";
	const message = Reflect.get(error, "message");
	return typeof message === "string" ? message : "알 수 없는 오류";
}
