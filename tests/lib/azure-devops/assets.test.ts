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

  it("keeps the organization when resolving a host-less attachment", async () => {
    const { resolveAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    // A root-relative path replaces the base's path, so resolving it against
    // the organization URL directly would drop the organization segment.
    expect(
      resolveAzureDevOpsAssetUrl(
        "/_apis/wit/attachments/abc?fileName=image.png",
      ).toString(),
    ).toBe(
      "https://dev.azure.com/example/_apis/wit/attachments/abc?fileName=image.png",
    );
  });

  it("resolves a host-less attachment for an organization on its own host", async () => {
    process.env.AZURE_DEVOPS_ORG_URL = "https://example.visualstudio.com";
    vi.resetModules();

    const { resolveAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    expect(
      resolveAzureDevOpsAssetUrl("/_apis/wit/attachments/abc").toString(),
    ).toBe("https://example.visualstudio.com/_apis/wit/attachments/abc");
  });

  it("accepts the organization's legacy host but not another organization's", async () => {
    const { isAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    expect(
      isAzureDevOpsAssetUrl("https://example.visualstudio.com/_apis/wit/attachments/abc"),
    ).toBe(true);
    // Sending this organization's token to another organization's host.
    expect(
      isAzureDevOpsAssetUrl("https://other.visualstudio.com/_apis/wit/attachments/abc"),
    ).toBe(false);
  });

  it("hands host-less API paths to the proxy and leaves page assets alone", async () => {
    const { isProxyableAzureDevOpsAssetUrl } = await import(
      "@/lib/azure-devops/assets"
    );

    expect(
      isProxyableAzureDevOpsAssetUrl("/_apis/wit/attachments/abc?fileName=i.png"),
    ).toBe(true);
    expect(
      isProxyableAzureDevOpsAssetUrl("/example/proj/_apis/wit/attachments/abc"),
    ).toBe(true);
    expect(isProxyableAzureDevOpsAssetUrl("/logo.png")).toBe(false);
    expect(isProxyableAzureDevOpsAssetUrl("./screenshot.png")).toBe(false);
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
