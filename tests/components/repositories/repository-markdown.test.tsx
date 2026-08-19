import { renderToStaticMarkup } from "react-dom/server";
import { RepositoryMarkdown } from "@/components/repositories/repository-markdown";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";

const VERSION = {
  type: "branch",
  value: "main",
} satisfies GitVersionDescriptor;

function renderMarkdown(content: string) {
  return renderToStaticMarkup(
    <RepositoryMarkdown
      content={content}
      path="/docs/README.md"
      projectId="project-id"
      repositoryId="repository-id"
      version={VERSION}
    />,
  );
}

describe("RepositoryMarkdown", () => {
  it("uses compact repository-specific typography", () => {
    const markup = renderMarkdown("# Heading\n\nA paragraph.");

    expect(markup).toContain('class="repository-markdown ');
    expect(markup).toContain('<h1 id="heading">Heading</h1>');
  });

  it("preserves repository image proportions without invented dimensions", () => {
    const markup = renderMarkdown(
      '![Architecture](../assets/diagram.png "System diagram")',
    );

    expect(markup).toContain('<img alt="Architecture"');
    expect(markup).toContain('loading="lazy"');
    expect(markup).toContain('decoding="async"');
    expect(markup).toContain('title="System diagram"');
    expect(markup).not.toMatch(/\s(?:height|width)="\d+"/);
    expect(markup).toContain(
      "/api/repos/project-id/repository-id/content",
    );
  });

  it("preserves linked repository image navigation", () => {
    const markup = renderMarkdown(
      "[![Architecture](../assets/diagram.png)](../docs/architecture.md)",
    );

    expect(markup).toContain(
      '<a href="/repos/project-id/repository-id/blob/docs/architecture.md?versionType=branch&amp;version=main"><span class="contents"><img alt="Architecture"',
    );
    expect(markup).not.toContain('aria-haspopup="dialog"');
    expect(markup).not.toContain('role="button"');
    expect(markup).not.toContain('tabindex="0"');
  });

  it("does not treat non-web URL schemes as repository images", () => {
    const markup = renderMarkdown("![Contact](mailto:owner@example.com)");

    expect(markup).not.toContain("mailto:");
    expect(markup).not.toContain("/api/repos/");
  });

  it("makes wide tables keyboard-scrollable", () => {
    const markup = renderMarkdown("| One | Two |\n| --- | --- |\n| A | B |");

    expect(markup).toContain(
      '<div class="repository-markdown-table" tabindex="0"><table>',
    );
  });
});
