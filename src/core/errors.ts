export class ExportError extends Error {
	override readonly name = "ExportError";

	constructor(
		message: string,
		override readonly cause?: unknown,
	) {
		super(message, cause === undefined ? undefined : { cause });
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
