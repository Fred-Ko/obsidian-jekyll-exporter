import { readFileSync, writeFileSync } from "fs";

// 현재 package.json의 버전을 가져옵니다
const currentVersion = process.env.npm_package_version;

// 버전을 파싱하고 마이너 버전을 증가시킵니다
const [major, minor, patch] = currentVersion.split(".").map(Number);
const targetVersion = `${major}.${minor}.${patch+1}`;

// package.json 업데이트
let packageJson = JSON.parse(readFileSync("package.json", "utf8"));
packageJson.version = targetVersion;
writeFileSync("package.json", JSON.stringify(packageJson, null, "\t"));

// manifest.json 업데이트
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// versions.json 업데이트
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
