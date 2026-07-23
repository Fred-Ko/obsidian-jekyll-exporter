import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { PermalinkStyle } from "../src/domain/types";
import { SettingsStore } from "../src/settings/settings-store";

const DEVICE_ID = "a".repeat(64);

class MemoryPersistence {
	saved: unknown;

	constructor(private readonly initial: unknown) {}

	async loadData(): Promise<unknown> {
		return this.saved ?? this.initial;
	}

	async saveData(data: unknown): Promise<void> {
		this.saved = data;
	}
}

function fakeApp(secrets: Map<string, string>): App {
	return {
		secretStorage: {
			getSecret: (name: string) => secrets.get(name) ?? null,
			setSecret: (name: string, value: string) => {
				secrets.set(name, value);
			},
		},
	} as unknown as App;
}

describe("SettingsStore", () => {
	it("migrates legacy settings and removes plaintext API keys", async () => {
		const persistence = new MemoryPersistence({
			targetFolders: ["/site"],
			frontMatterTemplate: "title: {{title}}",
			imageFolder: "assets/images",
			openaiApiBaseUrl: "https://example.com/v1",
			openaiModel: "custom-model",
			openaiApiKey: "legacy-secret",
			useAutoTags: true,
			permalinkStyle: PermalinkStyle.NanoId,
			[DEVICE_ID]: {
				activeTargetFolder: "/site",
				permalinkStyle: PermalinkStyle.FileNameNoUrlEncoding,
			},
		});
		const secrets = new Map<string, string>();
		const store = new SettingsStore(persistence, fakeApp(secrets), DEVICE_ID);

		const settings = await store.load();

		expect(settings.activeTargetFolder).toBe("/site");
		expect(settings.permalinkStyle).toBe(PermalinkStyle.FileNameNoUrlEncoding);
		expect(settings.openaiSecretName).toBe("jekyll-exporter-openai-api-key");
		expect(secrets.get(settings.openaiSecretName)).toBe("legacy-secret");
		expect(JSON.stringify(persistence.saved)).not.toContain("legacy-secret");
		expect(persistence.saved).toMatchObject({ schemaVersion: 2 });
	});

	it("falls back to a legacy shared permalink when no device override exists", async () => {
		const persistence = new MemoryPersistence({
			permalinkStyle: PermalinkStyle.FileNameUrlEncoded,
		});
		const store = new SettingsStore(persistence, fakeApp(new Map()), DEVICE_ID);

		expect((await store.load()).permalinkStyle).toBe(PermalinkStyle.FileNameUrlEncoded);
	});

	it("loads the current schema and resolves the selected secret", async () => {
		const secrets = new Map([["openai", "secret-value"]]);
		const persistence = new MemoryPersistence({
			schemaVersion: 2,
			shared: {
				targetFolders: ["/site"],
				frontMatterTemplate: "",
				imageFolder: "images",
				openaiApiBaseUrl: "https://api.openai.com/v1",
				openaiModel: "model",
				openaiSecretName: "openai",
				useAutoTags: false,
			},
			devices: {
				[DEVICE_ID]: {
					activeTargetFolder: "/site",
					permalinkStyle: PermalinkStyle.NanoId,
				},
			},
		});
		const store = new SettingsStore(persistence, fakeApp(secrets), DEVICE_ID);

		const settings = await store.load();
		expect(store.getOpenAiApiKey(settings)).toBe("secret-value");
	});
});
