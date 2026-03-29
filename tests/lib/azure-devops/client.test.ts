import { azureDevOpsRequest } from "@/lib/azure-devops/client";

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
    project: "Platform",
  })),
}));

describe("azureDevOpsRequest", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the default project-scoped api url and attaches headers", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: "ok" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const result = await azureDevOpsRequest<{ value: string }>("/_apis/test", {
      accessToken: "token",
    });

    expect(result).toEqual({ value: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://dev.azure.com/example/Platform/_apis/test?api-version=7.1"),
      expect.objectContaining({
        body: undefined,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token",
        },
        method: "GET",
      }),
    );
  });

  it("preserves explicit api-version and content type when a body is provided", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await azureDevOpsRequest("/_apis/test?api-version=8.0", {
      accessToken: "token",
      body: JSON.stringify({ hello: "world" }),
      contentType: "application/json-patch+json",
      method: "PATCH",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://dev.azure.com/example/Platform/_apis/test?api-version=8.0"),
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token",
          "Content-Type": "application/json-patch+json",
        },
        method: "PATCH",
      }),
    );
  });

  it("includes response details when the upstream request fails", async () => {
    fetchMock.mockResolvedValue(
      new Response("invalid revision", {
        status: 412,
        statusText: "Precondition Failed",
      }),
    );

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
      }),
    ).rejects.toThrow(
      "Azure DevOps request failed (412 Precondition Failed): invalid revision",
    );
  });
});
