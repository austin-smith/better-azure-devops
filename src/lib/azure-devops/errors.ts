export const AZURE_DEVOPS_ERROR_CODES = [
  "missing_config",
  "project_selection_required",
  "azure_cli_not_installed",
  "authentication_required",
  "permission_denied",
  "not_found",
  "revision_conflict",
  "create_status_unknown",
  "throttled",
  "network",
  "server",
  "unknown",
] as const;

export type AzureDevOpsErrorCode =
  (typeof AZURE_DEVOPS_ERROR_CODES)[number];

export type PublicAzureDevOpsRecoveryCommand = {
  label: string;
  value: string;
};

export type PublicAzureDevOpsError = {
  actionLabel: string | null;
  canRetry: boolean;
  code: AzureDevOpsErrorCode;
  message: string;
  recoveryCommands: readonly PublicAzureDevOpsRecoveryCommand[];
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
    message:
      "Set the organization URL in AZURE_DEVOPS_ORG_URL, then restart the app.",
    recoveryCommands: [
      {
        label: "Environment",
        value: "AZURE_DEVOPS_ORG_URL=https://dev.azure.com/<organization>",
      },
    ],
    title: "Connect an Azure DevOps organization",
  },
  project_selection_required: {
    actionLabel: null,
    canRetry: false,
    message:
      "Choose at least one project from the sidebar project switcher to load work items.",
    recoveryCommands: [],
    title: "Select an Azure DevOps project",
  },
  azure_cli_not_installed: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "Install Azure CLI, sign in from this project directory, then try again.",
    recoveryCommands: [],
    title: "Azure CLI is required",
  },
  authentication_required: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "The local Azure CLI session is missing or expired. Sign in from this project directory, then retry.",
    recoveryCommands: [
      {
        label: "macOS and Linux",
        value: "AZURE_CONFIG_DIR=.azure az login",
      },
      {
        label: "Windows PowerShell",
        value: '$env:AZURE_CONFIG_DIR=".azure"; az login',
      },
    ],
    title: "Sign in to Azure",
  },
  permission_denied: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "Your Azure account cannot access this organization, project, or work item. Ask an Azure DevOps administrator to grant access, then retry.",
    recoveryCommands: [],
    title: "Azure DevOps access denied",
  },
  not_found: {
    actionLabel: null,
    canRetry: false,
    message:
      "The requested Azure DevOps resource does not exist or is no longer available.",
    recoveryCommands: [],
    title: "Azure DevOps resource not found",
  },
  revision_conflict: {
    actionLabel: "Reload latest version",
    canRetry: true,
    message:
      "This task changed in Azure DevOps. Reload the latest version and try again.",
    recoveryCommands: [],
    title: "This work item changed",
  },
  create_status_unknown: {
    actionLabel: null,
    canRetry: false,
    message:
      "Azure DevOps may have created this work item even though the app did not receive confirmation. Check recent work items before submitting it again. Your draft is still available here.",
    recoveryCommands: [],
    title: "Confirm the work item before retrying",
  },
  throttled: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "Azure DevOps is limiting requests right now. Wait briefly, then try again.",
    recoveryCommands: [],
    title: "Azure DevOps is busy",
  },
  network: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "The app could not reach Azure DevOps. Check the network connection or VPN, then retry.",
    recoveryCommands: [],
    title: "Cannot reach Azure DevOps",
  },
  server: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "Azure DevOps returned a server error. The service may be temporarily unavailable.",
    recoveryCommands: [],
    title: "Azure DevOps is unavailable",
  },
  unknown: {
    actionLabel: "Try again",
    canRetry: true,
    message:
      "The request could not be completed. Retry, and check the server logs if the problem continues.",
    recoveryCommands: [],
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

export function parsePublicAzureDevOpsError(
  value: unknown,
): PublicAzureDevOpsError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (!isAzureDevOpsErrorCode(record.code)) {
    return null;
  }

  const error = createPublicAzureDevOpsError(record.code);
  const retryAfterSeconds =
    typeof record.retryAfterSeconds === "number" &&
    Number.isInteger(record.retryAfterSeconds) &&
    record.retryAfterSeconds >= 0
      ? record.retryAfterSeconds
      : null;

  return {
    ...error,
    retryAfterSeconds,
  };
}

export function getAzureDevOpsWorkItemCreateError(error: unknown) {
  if (error instanceof AzureDevOpsError) {
    const isAmbiguous =
      error.code === "network" ||
      error.code === "server" ||
      (error.code === "unknown" && error.status === null);

    if (!isAmbiguous) {
      return error;
    }
  }

  return new AzureDevOpsError(
    error instanceof Error
      ? error.message
      : "Azure DevOps work item creation status is unknown.",
    {
      cause: error,
      code: "create_status_unknown",
      status: error instanceof AzureDevOpsError ? error.status : null,
    },
  );
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
    case "create_status_unknown":
      return 500;
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
