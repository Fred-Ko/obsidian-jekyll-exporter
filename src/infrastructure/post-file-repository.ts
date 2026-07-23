import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ExportError, errorMessage } from "../core/errors";
import { isMatchingPublishedPost } from "../core/file-names";

export class PostFileRepository {
	async ensureDirectory(directory: string): Promise<void> {
		try {
			await fs.mkdir(directory, { recursive: true });
		} catch (error) {
			throw new ExportError(`대상 디렉터리를 만들 수 없습니다: ${directory} (${errorMessage(error)})`, error);
		}
	}

	async findPublishedPost(directory: string, postFileName: string): Promise<string | null> {
		let entries;
		try {
			entries = await fs.readdir(directory, { withFileTypes: true });
		} catch (error) {
			throw new ExportError(`발행 디렉터리를 읽을 수 없습니다: ${directory} (${errorMessage(error)})`, error);
		}

		const matches = entries
			.filter((entry) => entry.isFile() && isMatchingPublishedPost(entry.name, postFileName))
			.map((entry) => path.join(directory, entry.name));

		if (matches.length > 1) {
			throw new ExportError(`동일한 글로 판단되는 발행 파일이 여러 개입니다:\n${matches.join("\n")}`);
		}
		return matches[0] ?? null;
	}

	async read(filePath: string): Promise<string> {
		try {
			return await fs.readFile(filePath, "utf8");
		} catch (error) {
			throw new ExportError(`파일을 읽을 수 없습니다: ${filePath} (${errorMessage(error)})`, error);
		}
	}

	async writeAtomic(filePath: string, content: string): Promise<void> {
		const directory = path.dirname(filePath);
		const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

		try {
			await fs.writeFile(temporaryPath, content, { encoding: "utf8", flag: "wx" });
			await replaceFile(temporaryPath, filePath);
		} catch (error) {
			await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
			throw new ExportError(
				`파일을 안전하게 저장하지 못했습니다: ${filePath} (${errorMessage(error)})`,
				error,
			);
		}
	}

	async remove(filePath: string): Promise<void> {
		try {
			await fs.unlink(filePath);
		} catch (error) {
			throw new ExportError(
				`이전 발행 파일을 제거하지 못했습니다: ${filePath} (${errorMessage(error)})`,
				error,
			);
		}
	}
}

async function replaceFile(temporaryPath: string, targetPath: string): Promise<void> {
	try {
		await fs.rename(temporaryPath, targetPath);
		return;
	} catch (error) {
		if (!isWindowsReplaceError(error)) throw error;
	}

	const backupPath = `${targetPath}.${randomUUID()}.bak`;
	let targetWasMoved = false;
	try {
		await fs.rename(targetPath, backupPath);
		targetWasMoved = true;
		await fs.rename(temporaryPath, targetPath);
		await fs.rm(backupPath, { force: true });
	} catch (error) {
		if (targetWasMoved) {
			await fs.rename(backupPath, targetPath).catch(() => undefined);
		}
		throw error;
	}
}

function isWindowsReplaceError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) return false;
	const code = Reflect.get(error, "code");
	return code === "EEXIST" || code === "EPERM";
}
