#!/usr/bin/env node

import process from "node:process";
import { spawnSync } from "node:child_process";

const image = process.argv[2];
const platform = process.argv[3];

if (!image || process.argv.length > 4) {
  console.error(
    "Usage: node scripts/smoke-test-image.mjs <image> [linux/amd64|linux/arm64]",
  );
  process.exit(1);
}

if (platform && !["linux/amd64", "linux/arm64"].includes(platform)) {
  console.error(`Unsupported smoke-test platform: ${platform}`);
  process.exit(1);
}

const suffix = `${process.pid}-${Date.now()}`;
const containerName = `better-ado-smoke-${suffix}`;
const azureVolume = `${containerName}-azure`;
const dataVolume = `${containerName}-data`;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw new Error(`Could not run Docker: ${result.error.message}`);
  }

  if (result.status !== 0 && !options.allowFailure) {
    const details = options.capture
      ? (result.stderr || result.stdout).trim()
      : "";
    throw new Error(
      `docker ${args.join(" ")} failed${details ? `: ${details}` : "."}`,
    );
  }

  return {
    output: options.capture ? result.stdout.trim() : "",
    status: result.status,
  };
}

function platformArguments() {
  return platform ? ["--platform", platform] : [];
}

function startContainer() {
  docker([
    "run",
    "--detach",
    "--init",
    "--name",
    containerName,
    ...platformArguments(),
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges=true",
    "--env",
    "AZURE_DEVOPS_ORG_URL=https://dev.azure.com/example",
    "--mount",
    `type=volume,source=${azureVolume},target=/app/.azure`,
    "--mount",
    `type=volume,source=${dataVolume},target=/data`,
    image,
  ]);
}

function removeContainer() {
  docker(["rm", "--force", containerName], {
    allowFailure: true,
  });
}

function showLogs() {
  docker(["logs", containerName], {
    allowFailure: true,
  });
}

function getHealthStatus() {
  const result = docker(
    [
      "inspect",
      "--format",
      "{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}",
      containerName,
    ],
    {
      capture: true,
    },
  );

  return result.output;
}

async function waitForHealthy() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const status = getHealthStatus();

    if (status === "healthy") {
      return;
    }

    if (status === "unhealthy" || status === "missing") {
      throw new Error(`Container health status is ${status}.`);
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 2_000);
    });
  }

  throw new Error("Timed out waiting for the container to become healthy.");
}

async function main() {
  docker(["image", "inspect", image]);
  docker([
    "run",
    "--rm",
    ...platformArguments(),
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges=true",
    "--entrypoint",
    "sh",
    image,
    "-c",
    [
      'test "$(id -u)" = "10001"',
      'test "$(id -g)" = "10001"',
      "test -f /app/drizzle/0000_fast_nightshade.sql",
      "! command -v corepack",
      "! command -v npm",
      "! command -v npx",
      "! command -v yarn",
      "node --version",
      "az version --output none",
    ].join(" && "),
  ]);

  docker(["volume", "create", azureVolume]);
  docker(["volume", "create", dataVolume]);

  startContainer();
  await waitForHealthy();

  docker([
    "exec",
    containerName,
    "node",
    "-e",
    [
      "Promise.all([",
      "fetch('http://127.0.0.1:3002/'),",
      "fetch('http://127.0.0.1:3002/logo.png'),",
      "]).then((responses) => {",
      "if (responses.some((response) => !response.ok)) process.exit(1);",
      "}).catch(() => process.exit(1));",
    ].join(" "),
  ]);

  docker([
    "exec",
    containerName,
    "node",
    "-e",
    [
      'const Database = require("better-sqlite3");',
      'const db = new Database("/data/settings.sqlite", { readonly: true });',
      `const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name);`,
      'if (!tables.includes("app_settings") || !tables.includes("__drizzle_migrations")) process.exit(1);',
    ].join(" "),
  ]);

  removeContainer();
  startContainer();
  await waitForHealthy();

  console.log(
    `Smoke test passed for ${image}${platform ? ` on ${platform}` : ""}.`,
  );
}

main()
  .catch((error) => {
    showLogs();
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    removeContainer();
    docker(["volume", "rm", azureVolume, dataVolume], {
      allowFailure: true,
    });
  });
