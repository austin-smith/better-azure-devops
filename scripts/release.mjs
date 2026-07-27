#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  getPackageVersion,
  getReleaseTag,
} from "./lib/release-version.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function printUsage() {
  console.log(`Usage: pnpm release [--dry-run] [--yes]

Validates the committed version on main, creates its annotated Git tag, and
pushes that tag to origin. The tag starts the Docker publish workflow, which
publishes the GHCR image and creates the GitHub Release.

Options:
  --dry-run  Run every preflight check without creating or pushing a tag.
  --yes      Skip the interactive confirmation.
  --help     Show this help.`);
}

function parseArguments(arguments_) {
  const options = {
    dryRun: false,
    yes: false,
  };

  for (const argument of arguments_) {
    switch (argument) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--yes":
        options.yes = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = options.capture
      ? (result.stderr || result.stdout).trim()
      : "";
    throw new Error(
      `${command} ${args.join(" ")} failed${details ? `: ${details}` : "."}`,
    );
  }

  return options.capture ? result.stdout.trim() : "";
}

function hasLocalTag(tag) {
  const result = spawnSync(
    "git",
    ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`],
    {
      cwd: projectRoot,
      stdio: "ignore",
    },
  );

  if (result.error) {
    throw new Error(`Could not inspect local tags: ${result.error.message}`);
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error("Could not inspect local tags.");
  }

  return result.status === 0;
}

function hasRemoteTag(tag) {
  const result = spawnSync(
    "git",
    [
      "ls-remote",
      "--exit-code",
      "--tags",
      "origin",
      `refs/tags/${tag}`,
    ],
    {
      cwd: projectRoot,
      stdio: "ignore",
    },
  );

  if (result.error) {
    throw new Error(`Could not inspect remote tags: ${result.error.message}`);
  }

  if (result.status !== 0 && result.status !== 2) {
    throw new Error("Could not inspect remote tags.");
  }

  return result.status === 0;
}

async function confirmRelease(tag, commit) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive confirmation is unavailable. Re-run with --yes after reviewing the preflight output.",
    );
  }

  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await prompt.question(
      `Create and push ${tag} from ${commit.slice(0, 12)}? [y/N] `,
    );

    return answer.trim().toLowerCase() === "y";
  } finally {
    prompt.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const version = getPackageVersion(projectRoot);
  const tag = getReleaseTag(version);

  console.log(`Preparing ${tag}.`);

  const gitRoot = run("git", ["rev-parse", "--show-toplevel"], {
    capture: true,
  });

  if (path.resolve(gitRoot) !== projectRoot) {
    throw new Error(`Run the release from ${projectRoot}.`);
  }

  const branch = run("git", ["branch", "--show-current"], {
    capture: true,
  });

  if (branch !== "main") {
    throw new Error(`Releases must be created from main, not "${branch}".`);
  }

  const workingTree = run(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=normal"],
    {
      capture: true,
    },
  );

  if (workingTree) {
    throw new Error(
      "The working tree must be clean before creating a release tag.",
    );
  }

  console.log("Refreshing origin/main and release tags.");
  run("git", ["fetch", "--quiet", "--tags", "origin", "main"]);

  const commit = run("git", ["rev-parse", "HEAD"], {
    capture: true,
  });
  const originCommit = run("git", ["rev-parse", "origin/main"], {
    capture: true,
  });

  if (commit !== originCommit) {
    throw new Error(
      "HEAD must exactly match origin/main before creating a release.",
    );
  }

  if (hasLocalTag(tag) || hasRemoteTag(tag)) {
    throw new Error(`Release tag ${tag} already exists.`);
  }

  const checks = [
    ["pnpm", ["install", "--frozen-lockfile"]],
    ["pnpm", ["lint"]],
    ["pnpm", ["test"]],
    ["pnpm", ["build"]],
    ["pnpm", ["docker:check"]],
  ];

  for (const [command, args] of checks) {
    console.log(`Running ${command} ${args.join(" ")}.`);
    run(command, args);
  }

  if (options.dryRun) {
    console.log(
      `Dry run complete. ${tag} is ready to be created from ${commit}.`,
    );
    return;
  }

  if (!options.yes && !(await confirmRelease(tag, commit))) {
    console.log("Release cancelled.");
    return;
  }

  run("git", ["tag", "--annotate", tag, "--message", `release ${tag}`]);

  try {
    run("git", ["push", "origin", `refs/tags/${tag}`]);
  } catch (error) {
    console.error(
      `The push failed. The local ${tag} tag was preserved for inspection.`,
    );
    throw error;
  }

  console.log(
    `${tag} was pushed. GitHub Actions will publish the image and create the GitHub Release.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
