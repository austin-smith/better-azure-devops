import { countAnalyticsTextDiff } from "@/lib/analytics/diff-count";
import { measurePullRequestFiles } from "@/lib/analytics/measure";
import { listRepositoryCommitDiffs } from "@/lib/azure-devops/git/diffs";
import {
  getRepositoryItem,
  getRepositoryItemContent,
} from "@/lib/azure-devops/git/items";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/azure-devops/git/diffs", () => ({
  listRepositoryCommitDiffs: vi.fn(),
}));
vi.mock("@/lib/azure-devops/git/items", () => ({
  getRepositoryItem: vi.fn(),
  getRepositoryItemContent: vi.fn(),
}));

describe("analytics line measurement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not inflate churn for a pure rename", () => {
    expect(
      countAnalyticsTextDiff(
        { contents: "one\ntwo\n", name: "/old-name.ts" },
        { contents: "one\ntwo\n", name: "/new-name.ts" },
      ),
    ).toEqual({ additions: 0, deletions: 0 });
  });

  it("counts added and deleted lines", () => {
    expect(
      countAnalyticsTextDiff(
        { contents: "one\ntwo\n", name: "/file.ts" },
        { contents: "one\nthree\nfour\n", name: "/file.ts" },
      ),
    ).toEqual({ additions: 2, deletions: 1 });
  });

  it("drops tree entries and excludes submodules before loading content", async () => {
    vi.mocked(listRepositoryCommitDiffs).mockResolvedValue({
      allChangesIncluded: true,
      items: [
        {
          changeId: 1,
          changeType: "add",
          item: {
            gitObjectType: "tree",
            isFolder: true,
            objectId: "tree-id",
            path: "/src",
            url: null,
          },
          newContentTemplate: null,
          originalPath: null,
        },
        {
          changeId: 2,
          changeType: "add",
          item: {
            gitObjectType: "blob",
            isFolder: false,
            objectId: "blob-id",
            path: "/src/app.ts",
            url: null,
          },
          newContentTemplate: null,
          originalPath: null,
        },
        {
          changeId: 3,
          changeType: "edit",
          item: {
            gitObjectType: "commit",
            isFolder: false,
            objectId: "submodule-id",
            path: "/vendor/module",
            url: null,
          },
          newContentTemplate: null,
          originalPath: null,
        },
      ],
      nextCursor: null,
    });
    vi.mocked(getRepositoryItem).mockResolvedValue({
      commitId: "target",
      content: null,
      contentMetadata: {
        encoding: 65001,
        fileName: "app.ts",
        isBinary: false,
        isImage: false,
        mimeType: "text/plain",
      },
      gitObjectType: "blob",
      isFolder: false,
      latestChange: null,
      objectId: "blob-id",
      path: "/src/app.ts",
      size: 13,
      url: null,
    });
    vi.mocked(getRepositoryItemContent).mockResolvedValue(
      new Response("const app = 1;\n"),
    );

    const result = await measurePullRequestFiles(
      "token",
      "project",
      "repository",
      {
        baseCommitId: "base",
        signal: new AbortController().signal,
        targetCommitId: "target",
      },
    );

    expect(result).toEqual([
      expect.objectContaining({
        additions: 1,
        measurementStatus: "measured",
        path: "/src/app.ts",
      }),
      expect.objectContaining({
        measurementStatus: "submodule",
        path: "/vendor/module",
      }),
    ]);
    expect(getRepositoryItem).toHaveBeenCalledOnce();
    expect(getRepositoryItem).toHaveBeenCalledWith(
      "token",
      "project",
      "repository",
      "/src/app.ts",
      { type: "commit", value: "target" },
      expect.objectContaining({
        includeContentMetadata: true,
      }),
    );
  });

  it("rethrows response-stream failures so the job can retry", async () => {
    vi.mocked(listRepositoryCommitDiffs).mockResolvedValue({
      allChangesIncluded: true,
      items: [
        {
          changeId: 1,
          changeType: "add",
          item: {
            gitObjectType: "blob",
            isFolder: false,
            objectId: "blob-id",
            path: "/src/app.ts",
            url: null,
          },
          newContentTemplate: null,
          originalPath: null,
        },
      ],
      nextCursor: null,
    });
    vi.mocked(getRepositoryItem).mockResolvedValue({
      commitId: "target",
      content: null,
      contentMetadata: {
        encoding: 65001,
        fileName: "app.ts",
        isBinary: false,
        isImage: false,
        mimeType: "text/plain",
      },
      gitObjectType: "blob",
      isFolder: false,
      latestChange: null,
      objectId: "blob-id",
      path: "/src/app.ts",
      size: 13,
      url: null,
    });
    const streamError = new TypeError("connection closed");
    vi.mocked(getRepositoryItemContent).mockResolvedValue(
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(streamError);
          },
        }),
      ),
    );

    await expect(
      measurePullRequestFiles(
        "token",
        "project",
        "repository",
        {
          baseCommitId: "base",
          signal: new AbortController().signal,
          targetCommitId: "target",
        },
      ),
    ).rejects.toThrow("response body could not be read");
  });
});
