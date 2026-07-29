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

  it("builds the default org-scoped api url and attaches headers", async () => {
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
      new URL("https://dev.azure.com/example/_apis/test?api-version=7.1"),
      expect.objectContaining({
        body: undefined,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token",
        },
        method: "GET",
        next: undefined,
      }),
    );
  });

  it("allows slow-changing metadata requests to opt into scoped caching", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ value: "ok" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    await azureDevOpsRequest("/_apis/projects", {
      accessToken: "token",
      cache: "force-cache",
      next: {
        revalidate: 300,
        tags: ["ado-metadata:user:projects"],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        cache: "force-cache",
        next: {
          revalidate: 300,
          tags: ["ado-metadata:user:projects"],
        },
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
      new URL("https://dev.azure.com/example/_apis/test?api-version=8.0"),
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
    ).rejects.toMatchObject({
      code: "revision_conflict",
      message:
        "Azure DevOps request failed (412 Precondition Failed): invalid revision",
      status: 412,
    });
  });

  it("captures Azure DevOps throttling retry guidance", async () => {
    fetchMock.mockResolvedValue(
      new Response("slow down", {
        headers: { "retry-after": "12" },
        status: 429,
        statusText: "Too Many Requests",
      }),
    );

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
      }),
    ).rejects.toMatchObject({
      code: "throttled",
      retryAfterSeconds: 12,
      status: 429,
    });
  });

  it("preserves revision-conflict recovery for Azure DevOps 400 responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "The work item revision does not match the latest revision.",
        }),
        {
          status: 400,
          statusText: "Bad Request",
        },
      ),
    );

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
        revisionConflictOnBadRequest: true,
      }),
    ).rejects.toMatchObject({
      code: "revision_conflict",
      status: 400,
    });
  });

  it("does not treat revision text as a conflict outside work-item updates", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "The System.Rev field is not valid for this request.",
        }),
        {
          status: 400,
          statusText: "Bad Request",
        },
      ),
    );

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
      }),
    ).rejects.toMatchObject({
      code: "unknown",
      status: 400,
    });
  });

  it("classifies fetch failures as network errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
      }),
    ).rejects.toMatchObject({
      code: "network",
      status: null,
    });
  });

  it("times out an Azure DevOps request that never responds", async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;

          if (!(signal instanceof AbortSignal)) {
            reject(new Error("Expected a request signal."));
            return;
          }

          signal.addEventListener(
            "abort",
            () => reject(signal.reason),
            { once: true },
          );
        }),
    );

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
        timeoutMilliseconds: 10,
      }),
    ).rejects.toMatchObject({
      code: "network",
      message: "Azure DevOps did not respond within 1 seconds.",
    });
  });

  it("times out while Azure DevOps is still sending the response body", async () => {
    fetchMock.mockImplementation((_input, init) => {
      const signal = init?.signal;

      if (!(signal instanceof AbortSignal)) {
        throw new Error("Expected a request signal.");
      }

      const body = new ReadableStream({
        start(controller) {
          signal.addEventListener(
            "abort",
            () => controller.error(signal.reason),
            { once: true },
          );
        },
      });

      return Promise.resolve(
        new Response(body, {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );
    });

    await expect(
      azureDevOpsRequest("/_apis/test", {
        accessToken: "token",
        timeoutMilliseconds: 10,
      }),
    ).rejects.toMatchObject({
      code: "network",
      message:
        "Azure DevOps did not finish sending the response within 1 seconds.",
    });
  });
});
