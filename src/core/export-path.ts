import path from "node:path";
import { ExportError } from "./errors";

export function resolveExportDirectory(targetRoot: string, vaultFilePath: string): string {
	const root = path.resolve(targetRoot);
	const relativeDirectory = path.dirname(vaultFilePath);
	const destination = path.resolve(root, relativeDirectory, "_posts");

	if (destination !== root && !destination.startsWith(`${root}${path.sep}`)) {
		throw new ExportError(`발행 경로가 대상 루트를 벗어났습니다: ${destination}`);
	}
	return destination;
}
