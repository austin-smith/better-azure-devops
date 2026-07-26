#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPackageVersion,
  getReleaseTag,
} from "./lib/release-version.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const suppliedTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;

if (!suppliedTag) {
  console.error("Usage: node scripts/check-release-tag.mjs <tag>");
  process.exit(1);
}

try {
  const version = getPackageVersion(projectRoot);
  const expectedTag = getReleaseTag(version);

  if (suppliedTag !== expectedTag) {
    throw new Error(
      `Release tag "${suppliedTag}" does not match package version ${version}; expected "${expectedTag}".`,
    );
  }

  console.log(`Release tag ${suppliedTag} matches package version ${version}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
