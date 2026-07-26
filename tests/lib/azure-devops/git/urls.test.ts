import {
  encodeRepositoryPath,
  getGitVersionRefName,
  getRepositoryBlobHref,
  getRepositoryCommitDiffHref,
  getRepositoryCommitHref,
  getRepositoryTreeHref,
  normalizeRepositoryPath,
  parseGitVersionDescriptor,
  resolveRelativeRepositoryPath,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";

describe("Azure Git repository URLs", () => {
  it("keeps slash-containing branch names separate from item paths", () => {
    expect(
      getRepositoryTreeHref(
        "project id",
        "repository id",
        "/src/routes/[id].tsx",
        {
          type: "branch",
          value: "release/2026/q3",
        },
      ),
    ).toBe(
      "/repos/project%20id/repository%20id/tree/src/routes/%5Bid%5D.tsx?versionType=branch&version=release%2F2026%2Fq3",
    );
  });

  it("encodes each repository path segment without encoding separators", () => {
    expect(encodeRepositoryPath("/a b/hash#percent%.ts")).toBe(
      "a%20b/hash%23percent%25.ts",
    );
  });

  it("normalizes dot segments and cannot walk above the repository root", () => {
    expect(normalizeRepositoryPath("../../src/./app/../index.ts")).toBe(
      "/src/index.ts",
    );
  });

  it("resolves repository-relative markdown links", () => {
    expect(
      resolveRelativeRepositoryPath(
        "/docs/guides/README.md",
        "../assets/setup.png?raw=true",
      ),
    ).toBe("/docs/assets/setup.png");
    expect(
      resolveRelativeRepositoryPath(
        "/docs/guides/README.md",
        "/CONTRIBUTING.md#setup",
      ),
    ).toBe("/CONTRIBUTING.md");
    expect(
      resolveRelativeRepositoryPath(
        "/docs/README.md",
        "My%20Guide.md",
      ),
    ).toBe("/docs/My Guide.md");
    expect(
      resolveRelativeRepositoryPath(
        "/docs/README.md",
        "nested%2FGuide.md",
      ),
    ).toBe("/docs/nested/Guide.md");
  });

  it("parses validated version descriptors and defaults to the full default ref", () => {
    expect(
      parseGitVersionDescriptor({}, "refs/heads/main"),
    ).toEqual({
      type: "branch",
      value: "main",
    });
    expect(
      parseGitVersionDescriptor(
        {
          version: "v2.0",
          versionType: "tag",
        },
        "refs/heads/main",
      ),
    ).toEqual({
      type: "tag",
      value: "v2.0",
    });
  });

  it("maps branch and tag versions to their complete Git refs", () => {
    expect(
      getGitVersionRefName({ type: "branch", value: "release/2026" }),
    ).toBe("refs/heads/release/2026");
    expect(getGitVersionRefName({ type: "tag", value: "v2.0" })).toBe(
      "refs/tags/v2.0",
    );
    expect(getGitVersionRefName({ type: "commit", value: "abc123" })).toBeNull();
  });

  it("creates stable blob permalinks with line anchors", () => {
    expect(
      getRepositoryBlobHref(
        "project",
        "repository",
        "/src/index.ts",
        {
          type: "commit",
          value: "abc123",
        },
        42,
      ),
    ).toBe(
      "/repos/project/repository/blob/src/index.ts?versionType=commit&version=abc123#L42",
    );
  });

  it("strips only Azure Git ref prefixes", () => {
    expect(stripRefPrefix("refs/heads/feature/repo-browser")).toBe(
      "feature/repo-browser",
    );
    expect(stripRefPrefix("refs/tags/v1")).toBe("v1");
    expect(stripRefPrefix("custom/value")).toBe("custom/value");
  });

  it("preserves branch, path, and page context through commit details and diffs", () => {
    const history = {
      cursor: "50",
      path: "/src/app",
      version: {
        type: "branch" as const,
        value: "feature/repository explorer",
      },
    };

    expect(
      getRepositoryCommitHref("project", "repository", "abc123", {
        history,
      }),
    ).toBe(
      "/repos/project/repository/commits/abc123?historyVersionType=branch&historyVersion=feature%2Frepository+explorer&historyPath=%2Fsrc%2Fapp&historyCursor=50",
    );
    expect(
      getRepositoryCommitDiffHref(
        "project",
        "repository",
        "abc123",
        "/src/new name.ts",
        {
          basePath: "/src/old name.ts",
          changesCursor: "100",
          history,
        },
      ),
    ).toBe(
      "/repos/project/repository/commits/abc123/diff/src/new%20name.ts?basePath=%2Fsrc%2Fold+name.ts&changesCursor=100&historyVersionType=branch&historyVersion=feature%2Frepository+explorer&historyPath=%2Fsrc%2Fapp&historyCursor=50",
    );
  });
});
