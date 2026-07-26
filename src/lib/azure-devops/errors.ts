export const AZURE_DEVOPS_ERROR_CODES = [
  "missing_config",
  "project_selection_required",
  "azure_cli_not_installed",
  "authentication_required",
  "permission_denied",
  "not_found",
  "revision_conflict",
  "throttled",
  "network",
  "server",
  "unknown",
] as const;

export type AzureDevOpsErrorCode =
  (typeof AZURE_DEVOPS_ERROR_CODES)[number];

export type PublicAzureDevOpsError = {
  actionLabel: string | null;
  canRetry: boolean;
  code: AzureDevOpsErrorCode;
  command: string | null;
  message: string;
  retryAfterSeconds: number | null;
  title: string;
};

type AzureDevOpsErrorOptions = {
  cause?: unknown;
  code: AzureDevOpsErrorCode;
  retryAfterSeconds?: number | null;
  status?: number | null;
};

export class AzureDevOpsError extends Error {
  readonly code: AzureDevOpsErrorCode;
  readonly retryAfterSeconds: number | null;
  readonly status: number | null;

  constructor(message: string, options: AzureDevOpsErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "AzureDevOpsError";
    this.code = options.code;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.status = options.status ?? null;
  }
}

export function createMissingAzureDevOpsConfigError() {
  return new AzureDevOpsError(
    "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
    { code: "missing_config" },
  );
}

const PUBLIC_ERROR_CONTENT: Record<
  AzureDevOpsErrorCode,
  Omit<PublicAzureDevOpsError, "code" | "retryAfterSeconds">
> = {
  missing_config: {
    actionLabel: null,
    canRetry: false,
    command: "AZURE_DEVOPS_ORG_URL=https://dev.azure.com/<organization>",
    message:
      "Set the organization URL in AZURE_DEVOPS_ORG_URL, then restart the app.",
    title: "Connect an Azure DevOps organization",
  },
  project_selection_required: {
    actionLabel: null,
    canRetry: false,
    command: null,
    message:
      "Choose at least one project from the sidebar project switcher to load work items.",
    title: "Select an Azure DevOps project",
  },
  azure_cli_not_installed: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "Install Azure CLI, sign in from this project directory, then try again.",
    title: "Azure CLI is required",
  },
  authentication_required: {
    actionLabel: "Try again",
    canRetry: true,
    command: "AZURE_CONFIG_DIR=.azure az login",
    message:
      "The local Azure CLI session is missing or expired. Sign in from this project directory, then retry.",
    title: "Sign in to Azure",
  },
  permission_denied: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "Your Azure account cannot access this organization, project, or work item. Ask an Azure DevOps administrator to grant access, then retry.",
    title: "Azure DevOps access denied",
  },
  not_found: {
    actionLabel: null,
    canRetry: false,
    command: null,
    message:
      "The requested Azure DevOps resource does not exist or is no longer available.",
    title: "Azure DevOps resource not found",
  },
  revision_conflict: {
    actionLabel: "Reload latest version",
    canRetry: true,
    command: null,
    message:
      "This task changed in Azure DevOps. Reload the latest version and try again.",
    title: "This work item changed",
  },
  throttled: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "Azure DevOps is limiting requests right now. Wait briefly, then try again.",
    title: "Azure DevOps is busy",
  },
  network: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "The app could not reach Azure DevOps. Check the network connection or VPN, then retry.",
    title: "Cannot reach Azure DevOps",
  },
  server: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "Azure DevOps returned a server error. The service may be temporarily unavailable.",
    title: "Azure DevOps is unavailable",
  },
  unknown: {
    actionLabel: "Try again",
    canRetry: true,
    command: null,
    message:
      "The request could not be completed. Retry, and check the server logs if the problem continues.",
    title: "Azure DevOps request failed",
  },
};

export function getPublicAzureDevOpsError(
  error: unknown,
): PublicAzureDevOpsError {
  const azureDevOpsError =
    error instanceof AzureDevOpsError
      ? error
      : new AzureDevOpsError("Unexpected Azure DevOps error.", {
          cause: error,
          code: "unknown",
        });
  const content = PUBLIC_ERROR_CONTENT[azureDevOpsError.code];

  return {
    ...content,
    code: azureDevOpsError.code,
    retryAfterSeconds: azureDevOpsError.retryAfterSeconds,
  };
}

export function createPublicAzureDevOpsError(
  code: AzureDevOpsErrorCode,
): PublicAzureDevOpsError {
  return {
    ...PUBLIC_ERROR_CONTENT[code],
    code,
    retryAfterSeconds: null,
  };
}

export function getAzureDevOpsErrorHttpStatus(error: unknown) {
  if (error instanceof AzureDevOpsError && error.status) {
    if (error.code === "revision_conflict") {
      return 409;
    }

    return error.status;
  }

  const code =
    error instanceof AzureDevOpsError ? error.code : ("unknown" as const);

  switch (code) {
    case "missing_config":
      return 503;
    case "project_selection_required":
      return 409;
    case "azure_cli_not_installed":
      return 503;
    case "authentication_required":
      return 401;
    case "permission_denied":
      return 403;
    case "not_found":
      return 404;
    case "revision_conflict":
      return 409;
    case "throttled":
      return 429;
    case "network":
      return 502;
    case "server":
      return 503;
    case "unknown":
      return 500;
  }
}

export function isAzureDevOpsErrorCode(
  value: unknown,
): value is AzureDevOpsErrorCode {
  return (
    typeof value === "string" &&
    (AZURE_DEVOPS_ERROR_CODES as readonly string[]).includes(value)
  );
}
