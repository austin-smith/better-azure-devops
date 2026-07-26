import { execFile } from "node:child_process";
import path from "node:path";
import { AzureDevOpsError } from "@/lib/azure-devops/errors";

const AZURE_DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const AZURE_CLI_ACCESS_TOKEN_ARGS = [
  "account",
  "get-access-token",
  "--resource",
  AZURE_DEVOPS_RESOURCE,
  "-o",
  "json",
] as const;

function getAzureConfigDir() {
  const configuredPath = process.env.AZURE_CONFIG_DIR?.trim();

  return configuredPath || path.join(process.cwd(), ".azure");
}

type AzureCliAccessTokenResponse = {
  accessToken?: string;
  expiresOn?: string;
  expires_on?: number | string;
};

type ExecFileAsyncOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

let cachedToken:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;
let pendingToken: Promise<string> | null = null;

function parseExpiresAt(payload: AzureCliAccessTokenResponse) {
  if (typeof payload.expires_on === "number") {
    return payload.expires_on * 1000;
  }

  if (typeof payload.expires_on === "string") {
    const numeric = Number(payload.expires_on);

    if (Number.isFinite(numeric)) {
      return numeric * 1000;
    }
  }

  if (typeof payload.expiresOn === "string") {
    const parsed = Date.parse(payload.expiresOn);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Date.now() + 5 * 60_000;
}

function classifyAzureCliError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const errorCode =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;

  if (
    errorCode === "ENOENT" ||
    message.includes("is not recognized as an internal or external command")
  ) {
    return new AzureDevOpsError(
      "Azure CLI is not installed. Install it, then run `az login` with `AZURE_CONFIG_DIR` set to `.azure`.",
      {
        cause: error,
        code: "azure_cli_not_installed",
      },
    );
  }

  if (/az login|login required|not logged in/i.test(message)) {
    return new AzureDevOpsError(
      "Azure CLI is not signed in. Run `az login` with `AZURE_CONFIG_DIR` set to `.azure`, then reload.",
      {
        cause: error,
        code: "authentication_required",
      },
    );
  }

  return new AzureDevOpsError(
    `Failed to get an Azure DevOps access token from Azure CLI: ${message}`,
    {
      cause: error,
      code: "unknown",
    },
  );
}

function execFileAsync(
  file: string,
  args: readonly string[],
  options: ExecFileAsyncOptions,
) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, [...args], options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }

      resolve({ stderr, stdout });
    });
  });
}

async function runAzureCli() {
  const env = {
    ...process.env,
    AZURE_CONFIG_DIR: getAzureConfigDir(),
  };

  if (process.platform === "win32") {
    const comSpec = process.env.ComSpec;

    // Run from cmd.exe's own directory so a repo-local az.cmd cannot shadow Azure CLI.
    return execFileAsync(
      comSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `az ${AZURE_CLI_ACCESS_TOKEN_ARGS.join(" ")}`],
      {
        cwd: comSpec ? path.win32.dirname(comSpec) : undefined,
        env,
      },
    );
  }

  return execFileAsync("az", [...AZURE_CLI_ACCESS_TOKEN_ARGS], { env });
}

async function requestAzureDevOpsAccessToken() {
  try {
    const { stdout } = await runAzureCli();

    const payload = JSON.parse(stdout) as AzureCliAccessTokenResponse;

    if (!payload.accessToken) {
      throw new Error("Azure CLI returned a token payload without accessToken.");
    }

    cachedToken = {
      accessToken: payload.accessToken,
      expiresAt: parseExpiresAt(payload),
    };

    return payload.accessToken;
  } catch (error) {
    if (error instanceof AzureDevOpsError) {
      throw error;
    }

    throw classifyAzureCliError(error);
  }
}

export async function getAzureDevOpsAccessToken() {
  if (
    cachedToken &&
    cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()
  ) {
    return cachedToken.accessToken;
  }

  if (!pendingToken) {
    pendingToken = requestAzureDevOpsAccessToken().finally(() => {
      pendingToken = null;
    });
  }

  return pendingToken;
}
