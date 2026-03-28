import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const AZURE_DEVOPS_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const AZURE_CONFIG_DIR = path.join(process.cwd(), ".azure");

type AzureCliAccessTokenResponse = {
  accessToken?: string;
  expiresOn?: string;
  expires_on?: number | string;
};

let cachedToken:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | null = null;

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

function formatAzureCliError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("ENOENT")) {
    return "Azure CLI is not installed. Install it and run `AZURE_CONFIG_DIR=.azure az login`.";
  }

  if (message.includes("az login")) {
    return "Azure CLI is not signed in. Run `AZURE_CONFIG_DIR=.azure az login` and reload.";
  }

  return `Failed to get an Azure DevOps access token from Azure CLI: ${message}`;
}

export async function getAzureDevOpsAccessToken() {
  if (
    cachedToken &&
    cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()
  ) {
    return cachedToken.accessToken;
  }

  try {
    const { stdout } = await execFileAsync("az", [
      "account",
      "get-access-token",
      "--resource",
      AZURE_DEVOPS_RESOURCE,
      "-o",
      "json",
    ], {
      env: {
        ...process.env,
        AZURE_CONFIG_DIR,
      },
    });

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
    throw new Error(formatAzureCliError(error));
  }
}
