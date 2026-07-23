import path from "node:path";
import type { JekyllExportSettings } from "../domain/types";

export function validateSettingsShape(settings: JekyllExportSettings): string[] {
	const errors: string[] = [];

	if (!settings.activeTargetFolder.trim()) {
		errors.push("활성 대상 폴더를 선택해 주세요.");
	}

	if (!settings.imageFolder.trim()) {
		errors.push("이미지 폴더를 입력해 주세요.");
	} else if (path.isAbsolute(settings.imageFolder) || settings.imageFolder.split(/[\\/]/).includes("..")) {
		errors.push("이미지 폴더는 상위 경로(..)가 없는 상대 경로여야 합니다.");
	}

	try {
		const url = new URL(settings.openaiApiBaseUrl);
		if (!["http:", "https:"].includes(url.protocol)) {
			errors.push("API Base URL은 HTTP 또는 HTTPS 주소여야 합니다.");
		}
	} catch {
		errors.push("API Base URL 형식이 올바르지 않습니다.");
	}

	if (!settings.openaiModel.trim()) {
		errors.push("OpenAI 모델 이름을 입력해 주세요.");
	}

	return errors;
}
