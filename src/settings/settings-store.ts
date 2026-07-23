import type { App } from "obsidian";
import { DEFAULT_SETTINGS } from "../config/defaults";
import { PermalinkStyle, type JekyllExportSettings } from "../domain/types";

const SCHEMA_VERSION = 2;
const LEGACY_SECRET_NAME = "jekyll-exporter-openai-api-key";
const DEVICE_ID_PATTERN = /^[a-f0-9]{64}$/;

interface SettingsPersistence {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

interface DeviceSettings {
	activeTargetFolder?: string;
	permalinkStyle?: PermalinkStyle;
}

interface PersistedSettings {
	schemaVersion: number;
	shared: Omit<JekyllExportSettings, "activeTargetFolder" | "permalinkStyle">;
	devices: Record<string, DeviceSettings>;
}

export class SettingsStore {
	private devices: Record<string, DeviceSettings> = {};

	constructor(
		private readonly persistence: SettingsPersistence,
		private readonly app: App,
		private readonly deviceId: string,
	) {}

	async load(): Promise<JekyllExportSettings> {
		const raw = asRecord(await this.persistence.loadData());
		const isCurrentSchema = raw.schemaVersion === SCHEMA_VERSION;
		const shared = asRecord(isCurrentSchema ? raw.shared : raw);

		this.devices = isCurrentSchema ? readDevices(raw.devices) : readLegacyDevices(raw);
		const device = this.devices[this.deviceId] ?? asDeviceSettings(raw[this.deviceId]);

		const settings: JekyllExportSettings = {
			targetFolders: readStringArray(shared.targetFolders, DEFAULT_SETTINGS.targetFolders),
			frontMatterTemplate: readString(shared.frontMatterTemplate, DEFAULT_SETTINGS.frontMatterTemplate),
			imageFolder: readString(shared.imageFolder, DEFAULT_SETTINGS.imageFolder),
			activeTargetFolder: readString(device.activeTargetFolder, DEFAULT_SETTINGS.activeTargetFolder),
			openaiApiBaseUrl: readString(shared.openaiApiBaseUrl, DEFAULT_SETTINGS.openaiApiBaseUrl),
			openaiModel: readString(shared.openaiModel, DEFAULT_SETTINGS.openaiModel),
			openaiSecretName: readString(shared.openaiSecretName, DEFAULT_SETTINGS.openaiSecretName),
			useAutoTags: readBoolean(shared.useAutoTags, DEFAULT_SETTINGS.useAutoTags),
			permalinkStyle: readPermalinkStyle(device.permalinkStyle ?? shared.permalinkStyle),
		};

		const legacyApiKey = readString(shared.openaiApiKey, "");
		if (legacyApiKey) {
			const secretName = settings.openaiSecretName || LEGACY_SECRET_NAME;
			this.app.secretStorage.setSecret(secretName, legacyApiKey);
			settings.openaiSecretName = secretName;
		}

		if (!isCurrentSchema || legacyApiKey) {
			await this.save(settings);
		}

		return settings;
	}

	async save(settings: JekyllExportSettings): Promise<void> {
		this.devices[this.deviceId] = {
			activeTargetFolder: settings.activeTargetFolder,
			permalinkStyle: settings.permalinkStyle,
		};

		const persisted: PersistedSettings = {
			schemaVersion: SCHEMA_VERSION,
			shared: {
				targetFolders: [...settings.targetFolders],
				frontMatterTemplate: settings.frontMatterTemplate,
				imageFolder: settings.imageFolder,
				openaiApiBaseUrl: settings.openaiApiBaseUrl,
				openaiModel: settings.openaiModel,
				openaiSecretName: settings.openaiSecretName,
				useAutoTags: settings.useAutoTags,
			},
			devices: this.devices,
		};

		await this.persistence.saveData(persisted);
	}

	getOpenAiApiKey(settings: JekyllExportSettings): string {
		return settings.openaiSecretName
			? (this.app.secretStorage.getSecret(settings.openaiSecretName) ?? "")
			: "";
	}
}

function readLegacyDevices(raw: Record<string, unknown>): Record<string, DeviceSettings> {
	return Object.fromEntries(
		Object.entries(raw)
			.filter(([key]) => DEVICE_ID_PATTERN.test(key))
			.map(([key, value]) => [key, asDeviceSettings(value)]),
	);
}

function readDevices(value: unknown): Record<string, DeviceSettings> {
	const devices = asRecord(value);
	return Object.fromEntries(Object.entries(devices).map(([key, device]) => [key, asDeviceSettings(device)]));
}

function asDeviceSettings(value: unknown): DeviceSettings {
	const record = asRecord(value);
	const result: DeviceSettings = {};
	if (typeof record.activeTargetFolder === "string") {
		result.activeTargetFolder = record.activeTargetFolder;
	}
	if (Object.values(PermalinkStyle).includes(record.permalinkStyle as PermalinkStyle)) {
		result.permalinkStyle = record.permalinkStyle as PermalinkStyle;
	}
	return result;
}

function asRecord(value: unknown): Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};
}

function readString(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] : [...fallback];
}

function readPermalinkStyle(value: unknown): PermalinkStyle {
	return Object.values(PermalinkStyle).includes(value as PermalinkStyle)
		? (value as PermalinkStyle)
		: DEFAULT_SETTINGS.permalinkStyle;
}
