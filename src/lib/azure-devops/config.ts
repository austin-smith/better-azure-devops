export type AzureDevOpsConfig = {
  apiVersion: string;
  orgUrl: string;
  project: string;
};

const API_VERSION = "7.1";

function readEnv(name: string) {
  const value = process.env[name];

  return value?.trim() || "";
}

export function getAzureDevOpsConfig(): AzureDevOpsConfig {
  const orgUrl = readEnv("AZURE_DEVOPS_ORG_URL").replace(/\/$/, "");
  const project = readEnv("AZURE_DEVOPS_PROJECT");

  if (!orgUrl || !project) {
    throw new Error(
      "Azure DevOps config is incomplete. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
    );
  }

  return {
    apiVersion: API_VERSION,
    orgUrl,
    project,
  };
}

export function hasAzureDevOpsConfig() {
  return Boolean(readEnv("AZURE_DEVOPS_ORG_URL") && readEnv("AZURE_DEVOPS_PROJECT"));
}
