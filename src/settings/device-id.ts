import { createHash } from "node:crypto";
import os from "node:os";

export function createDeviceId(): string {
	return createHash("sha256").update(`${os.hostname()}-${os.platform()}-${os.arch()}`).digest("hex");
}
