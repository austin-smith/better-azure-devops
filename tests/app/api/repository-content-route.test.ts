import { GET } from "@/app/api/repos/[projectId]/[repositoryId]/content/route";

const {
  getAzureDevOpsAccessTokenMock,
  getRepositoryItemContentMock,
} = vi.hoisted(() => ({
  getAzureDevOpsAccessTokenMock: vi.fn(),
  getRepositoryItemContentMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/access-token", () => ({
  getAzureDevOpsAccessToken: getAzureDevOpsAccessTokenMock,
}));

vi.mock("@/lib/azure-devops/git/items", () => ({
  getRepositoryItemContent: getRepositoryItemContentMock,
}));

describe("repository content route", () => {
  beforeEach(() => {
    getAzureDevOpsAccessTokenMock.mockReset();
    getRepositoryItemContentMock.mockReset();
    getAzureDevOpsAccessTokenMock.mockResolvedValue("token");
  });

  it("sandboxes active repository content and forces it to download", async () => {
    getRepositoryItemContentMock.mockResolvedValue(
      new Response("<script>window.parent.pwned = true</script>", {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
    );

    const response = await GET(
      new Request(
        "https://example.test/api/repos/project/repository/content?path=%2Fdemo.html&versionType=branch&version=main",
      ),
      {
        params: Promise.resolve({
          projectId: "project",
          repositoryId: "repository",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="demo.html"; filename*=UTF-8''demo.html`,
    );
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
    expect(response.headers.get("x-content-type-options")).toBe(
      "nosniff",
    );
    await expect(response.text()).resolves.toContain("<script>");
  });

  it("preserves exact SVG bytes for explicit downloads", async () => {
    const source = '<svg><script>alert("source")</script></svg>';

    getRepositoryItemContentMock.mockResolvedValue(
      new Response(source, {
        headers: {
          "content-type": "image/svg+xml",
        },
      }),
    );

    const response = await GET(
      new Request(
        "https://example.test/api/repos/project/repository/content?path=%2Flogo.svg&versionType=branch&version=main&download=true",
      ),
      {
        params: Promise.resolve({
          projectId: "project",
          repositoryId: "repository",
        }),
      },
    );

    expect(getRepositoryItemContentMock).toHaveBeenCalledWith(
      "token",
      "project",
      "repository",
      "/logo.svg",
      {
        type: "branch",
        value: "main",
      },
      {
        download: true,
        resolveLfs: true,
        sanitize: false,
      },
    );
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="logo.svg"; filename*=UTF-8''logo.svg`,
    );
    await expect(response.text()).resolves.toBe(source);
  });

  it("does not forward an upstream content length for a decoded stream", async () => {
    getRepositoryItemContentMock.mockResolvedValue(
      new Response("decoded content", {
        headers: {
          "content-length": "7",
          "content-type": "text/plain",
        },
      }),
    );

    const response = await GET(
      new Request(
        "https://example.test/api/repos/project/repository/content?path=%2Freadme.txt&versionType=branch&version=main",
      ),
      {
        params: Promise.resolve({
          projectId: "project",
          repositoryId: "repository",
        }),
      },
    );

    expect(response.headers.get("content-length")).toBeNull();
    await expect(response.text()).resolves.toBe("decoded content");
  });

  it("encodes Unicode download names with a safe ASCII fallback", async () => {
    getRepositoryItemContentMock.mockResolvedValue(
      new Response("document", {
        headers: {
          "content-type": "application/pdf",
        },
      }),
    );

    const response = await GET(
      new Request(
        "https://example.test/api/repos/project/repository/content?path=%2FR%C3%A9sum%C3%A9%20%22draft%22.pdf&versionType=branch&version=main",
      ),
      {
        params: Promise.resolve({
          projectId: "project",
          repositoryId: "repository",
        }),
      },
    );

    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="R_sum_ _draft_.pdf"; filename*=UTF-8''R%C3%A9sum%C3%A9%20%22draft%22.pdf`,
    );
  });
});
