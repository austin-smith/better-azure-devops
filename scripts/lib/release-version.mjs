import fs from "node:fs";
import path from "node:path";

const RELEASE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*)?$/;

export function assertReleaseVersion(version) {
  if (
    typeof version !== "string" ||
    !RELEASE_VERSION_PATTERN.test(version)
  ) {
    throw new Error(
      `Package version "${String(version)}" is not a supported release version.`,
    );
  }

  return version;
}

export function getPackageVersion(projectRoot) {
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  return assertReleaseVersion(packageJson.version);
}

export function getReleaseTag(version) {
  return `v${assertReleaseVersion(version)}`;
}
