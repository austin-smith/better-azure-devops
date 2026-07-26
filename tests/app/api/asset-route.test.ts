import { NextRequest } from "next/server";
import { GET } from "@/app/api/azure-devops/asset/route";

const {
  getAzureDevOpsAccessTokenMock,
  hasAzureDevOpsConfigMock,
  resolveAzureDevOpsAssetUrlMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  hasAzureDevOpsConfigMock: vi.fn(),
  resolveAzureDevOpsAssetUrlMock: vi.fn(),
}));
const fetchMock = vi.fn<typeof fetch>();

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/assets", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/azure-devops/assets")
  >("@/lib/azure-devops/assets");

  return {
    AzureDevOpsAssetError: actual.AzureDevOpsAssetError,
    resolveAzureDevOpsAssetUrl: resolveAzureDevOpsAssetUrlMock,
  };
});

vi.mock("@/lib/azure-devops/config", () => ({
  hasAzureDevOpsConfig: hasAzureDevOpsConfigMock,
}));

describe("GET /api/azure-devops/asset", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockReset();
    hasAzureDevOpsConfigMock.mockReset();
    resolveAzureDevOpsAssetUrlMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    hasAzureDevOpsConfigMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a source it will not fetch with a bad request", async () => {
    const { AzureDevOpsAssetError } = await import(
      "@/lib/azure-devops/assets"
    );

    resolveAzureDevOpsAssetUrlMock.mockImplementation(() => {
      throw new AzureDevOpsAssetError(
        "Azure DevOps asset URL host is not allowed.",
      );
    });

    const response = await GET(
      new NextRequest(
        "http://localhost/api/azure-devops/asset?src=https%3A%2F%2Fother.visualstudio.com%2Fa.png",
      ),
    );

    // Not a 500: the request was answerable and the answer is no.
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Azure DevOps asset URL host is not allowed.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still reports an unexpected failure as a fault", async () => {
    resolveAzureDevOpsAssetUrlMock.mockImplementation(() => {
      throw new Error("boom");
    });

    const response = await GET(
      new NextRequest("http://localhost/api/azure-devops/asset?src=x"),
    );

    expect(response.status).toBe(500);
  });

  it("validates config and required params", async () => {
    hasAzureDevOpsConfigMock.mockReturnValue(false);

    const missingConfigResponse = await GET(
      new NextRequest("http://localhost/api/azure-devops/asset?src=x"),
    );

    expect(missingConfigResponse.status).toBe(503);

    hasAzureDevOpsConfigMock.mockReturnValue(true);

    const missingSourceResponse = await GET(
      new NextRequest("http://localhost/api/azure-devops/asset"),
    );

    expect(missingSourceResponse.status).toBe(400);
    await expect(missingSourceResponse.json()).resolves.toEqual({
      error: "Missing asset source.",
    });
  });

  it("rejects non-image upstream responses", async () => {
    resolveAzureDevOpsAssetUrlMock.mockReturnValue(new URL("https://dev.azure.com/example"));
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    fetchMock.mockResolvedValue(
      new Response("{}", {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/azure-devops/asset?src=https://dev.azure.com/example"),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Azure DevOps asset is not an image.",
    });
  });

  it("streams upstream image bytes with cache headers", async () => {
    resolveAzureDevOpsAssetUrlMock.mockReturnValue(
      new URL("https://dev.azure.com/example/avatar.png"),
    );
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
    fetchMock.mockResolvedValue(
      new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/png" },
        status: 200,
        statusText: "OK",
      }),
    );

    const response = await GET(
      new NextRequest(
        "http://localhost/api/azure-devops/asset?src=https://dev.azure.com/example/avatar.png",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=300");
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(await response.arrayBuffer()).toEqual(Uint8Array.from([1, 2, 3]).buffer);
  });
});
