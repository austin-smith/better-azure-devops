describe("azure-devops asset helpers", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      AZURE_DEVOPS_ORG_URL: "https://dev.azure.com/example",
      AZURE_DEVOPS_PROJECT: "Platform",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("builds proxy paths for upstream asset urls", async () => {
    const { buildAzureDevOpsAssetProxyPath } = await import("@/lib/azure-devops/assets");

    expect(
      buildAzureDevOpsAssetProxyPath("https://dev.azure.com/example/_apis/avatar?id=123"),
    ).toBe(
      "/api/azure-devops/asset?src=https%3A%2F%2Fdev.azure.com%2Fexample%2F_apis%2Favatar%3Fid%3D123",
    );
  });

  it("resolves relative and allowed absolute asset urls", async () => {
    const { isAzureDevOpsAssetUrl, resolveAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    expect(
      resolveAzureDevOpsAssetUrl("https://dev.azure.com/example/_apis/avatar?id=123").toString(),
    ).toBe(
      "https://dev.azure.com/example/_apis/avatar?id=123",
    );
    expect(
      resolveAzureDevOpsAssetUrl("https://vssps.dev.azure.com/example/_apis/avatar?id=123")
        .host,
    ).toBe("vssps.dev.azure.com");
    expect(isAzureDevOpsAssetUrl("https://aex.dev.azure.com/example")).toBe(true);
  });

  it("rejects non-https and disallowed hosts", async () => {
    const { isAzureDevOpsAssetUrl, resolveAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    expect(() => resolveAzureDevOpsAssetUrl("http://dev.azure.com/example")).toThrow(
      "Azure DevOps asset URL must use HTTPS.",
    );
    expect(() => resolveAzureDevOpsAssetUrl("https://example.com/avatar.png")).toThrow(
      "Azure DevOps asset URL host is not allowed.",
    );
    expect(isAzureDevOpsAssetUrl("https://example.com/avatar.png")).toBe(false);
  });
});
