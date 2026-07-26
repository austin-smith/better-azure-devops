import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryBlob } from "@/components/repositories/repository-blob";
import type { AzureGitItem } from "@/lib/azure-devops/git/types";

const IMAGE_ITEM: AzureGitItem = {
  commitId: "commit-id",
  content: null,
  contentMetadata: {
    encoding: null,
    fileName: "wide-logo.png",
    isBinary: true,
    isImage: true,
    mimeType: "image/png",
  },
  gitObjectType: "blob",
  isFolder: false,
  latestChange: null,
  objectId: "object-id",
  path: "/assets/wide-logo.png",
  size: 12_345,
  url: null,
};

describe("RepositoryBlob", () => {
  it("preserves unknown image proportions without fabricated dimensions", () => {
    const markup = renderToStaticMarkup(
      <RepositoryBlob
        item={IMAGE_ITEM}
        kind="image"
        path="/assets/wide-logo.png"
        preloadedFile={null}
        projectId="project-id"
        repositoryId="repository-id"
        version={{ type: "branch", value: "main" }}
      />,
    );

    expect(markup).toContain('<img alt="wide-logo.png"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
    expect(markup).toContain("max-h-[72vh]");
    expect(markup).toContain(
      "/api/repos/project-id/repository-id/content",
    );
    const imageMarkup = markup.match(/<img[^>]+>/)?.[0];

    expect(imageMarkup).toBeDefined();
    expect(imageMarkup).not.toMatch(/\s(?:height|width)="\d+"/);
  });
});
