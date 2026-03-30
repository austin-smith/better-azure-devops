describe("azure-devops config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("detects when the required configuration is present", async () => {
    process.env.AZURE_DEVOPS_ORG_URL = "https://dev.azure.com/example/";
    process.env.AZURE_DEVOPS_PROJECT = "Platform";

    const {
      getAzureDevOpsConfig,
      getAzureDevOpsOrganizationName,
      hasAzureDevOpsConfig,
    } = await import("@/lib/azure-devops/config");

    expect(hasAzureDevOpsConfig()).toBe(true);
    expect(getAzureDevOpsConfig()).toEqual({
      apiVersion: "7.1",
      orgUrl: "https://dev.azure.com/example",
    });
    expect(getAzureDevOpsOrganizationName()).toBe("example");
  });

  it("supports legacy visualstudio organization urls", async () => {
    process.env.AZURE_DEVOPS_ORG_URL = "https://legacyorg.visualstudio.com";
    process.env.AZURE_DEVOPS_PROJECT = "Platform";

    const { getAzureDevOpsOrganizationName } = await import("@/lib/azure-devops/config");

    expect(getAzureDevOpsOrganizationName()).toBe("legacyorg");
  });

  it("throws when configuration is missing", async () => {
    delete process.env.AZURE_DEVOPS_ORG_URL;
    delete process.env.AZURE_DEVOPS_PROJECT;

    const { getAzureDevOpsConfig } = await import("@/lib/azure-devops/config");

    expect(() => getAzureDevOpsConfig()).toThrow(
      "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
    );
  });
});
