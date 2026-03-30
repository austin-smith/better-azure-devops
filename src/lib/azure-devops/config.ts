function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function parseOrganizationName(orgUrl: string) {
  const url = new URL(orgUrl);

  if (url.hostname === "dev.azure.com") {
    return url.pathname.split("/").filter(Boolean)[0] ?? "";
  }

  return url.hostname.split(".")[0] ?? "";
}

export function hasAzureDevOpsConfig() {
  return Boolean(readEnv("AZURE_DEVOPS_ORG_URL"));
}

export function getAzureDevOpsConfig() {
  const orgUrl = readEnv("AZURE_DEVOPS_ORG_URL").replace(/\/$/, "");

  if (!orgUrl) {
    throw new Error("Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.");
  }

  return {
    apiVersion: "7.1",
    orgUrl,
  };
}

export function getLegacyAzureDevOpsProject() {
  return readEnv("AZURE_DEVOPS_PROJECT");
}

export function getAzureDevOpsOrganizationName() {
  const { orgUrl } = getAzureDevOpsConfig();
  const organization = parseOrganizationName(orgUrl);

  if (!organization) {
    throw new Error("Could not determine the Azure DevOps organization name.");
  }

  return organization;
}
