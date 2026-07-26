// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { AzureDevOpsMarkupView } from "@/components/azure-devops/azure-devops-markup";

function renderMarkdown(content: string) {
  return render(
    <AzureDevOpsMarkupView markup={{ content, format: "markdown" }} />,
  );
}

describe("AzureDevOpsMarkupView markdown", () => {
  it("renders collapsible sections written as raw html", () => {
    const { container } = renderMarkdown(
      [
        "<details>",
        "<summary>Proposed wording</summary>",
        "",
        "Collapsed body text.",
        "",
        "</details>",
      ].join("\n"),
    );

    const details = container.querySelector("details");

    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toBe(
      "Proposed wording",
    );
    expect(details?.textContent).toContain("Collapsed body text.");
  });

  it("keeps a collapsed section closed so it does not flood the thread", () => {
    const { container } = renderMarkdown(
      "<details>\n<summary>Details</summary>\n\nHidden.\n\n</details>",
    );

    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("preserves the checked state of task lists", () => {
    renderMarkdown("- [x] done\n- [ ] pending");

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];

    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]?.checked).toBe(true);
    expect(checkboxes[1]?.checked).toBe(false);
  });

  it("keeps alternative text on images", () => {
    renderMarkdown("![a diagram](https://example.com/a.png)");

    expect(screen.getByAltText("a diagram")).toBeTruthy();
  });

  it("still renders GitHub flavoured tables", () => {
    const { container } = renderMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |",
    );

    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("td")).toHaveLength(2);
  });

  it("strips script elements from untrusted comment html", () => {
    const { container } = renderMarkdown(
      "<script>window.pwned = true;</script>\n\nSafe text.",
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("Safe text.");
  });

  it("strips inline event handlers", () => {
    const { container } = renderMarkdown(
      '<img src="x" alt="x" onerror="window.pwned = true" />',
    );

    expect(container.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });

  it("removes iframes and style elements", () => {
    const { container } = renderMarkdown(
      '<iframe src="https://evil.example"></iframe><style>body{display:none}</style>',
    );

    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("style")).toBeNull();
  });

  it("routes Azure DevOps attachments through the authenticated proxy", () => {
    const attachment =
      "https://dev.azure.com/example/project/_apis/git/repositories/repo/pullRequests/1/attachments/image%20%283%29.png";

    renderMarkdown(`![shot](${attachment})`);

    const source = screen.getByAltText("shot").getAttribute("src") ?? "";

    expect(source).toBe(
      `/api/azure-devops/asset?src=${encodeURIComponent(attachment)}`,
    );
  });

  it("proxies attachments embedded as html", () => {
    const attachment =
      "https://dev.azure.com/example/_apis/git/repositories/r/pullRequests/1/attachments/a.png";

    render(
      <AzureDevOpsMarkupView
        markup={{
          content: `<img src="${attachment}" alt="shot" />`,
          format: "html",
        }}
      />,
    );

    expect(screen.getByAltText("shot").getAttribute("src")).toContain(
      "/api/azure-devops/asset?src=",
    );
  });

  it("leaves images hosted outside Azure DevOps untouched", () => {
    renderMarkdown("![external](https://example.com/diagram.png)");

    expect(screen.getByAltText("external").getAttribute("src")).toBe(
      "https://example.com/diagram.png",
    );
  });

  it("blocks external images when rendering untrusted review comments", () => {
    const { container } = render(
      <AzureDevOpsMarkupView
        blockExternalImages
        markup={{
          content:
            "![tracking pixel](https://attacker.example/pixel.png)",
          format: "markdown",
        }}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(
      "[Image blocked: tracking pixel]",
    );
  });

  it("removes external image sources from untrusted raw html", () => {
    const { container } = render(
      <AzureDevOpsMarkupView
        blockExternalImages
        markup={{
          content:
            '<img src="https://attacker.example/pixel.png" alt="pixel" />',
          format: "html",
        }}
      />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBeNull();
  });

  it("does not emit javascript urls from raw anchors", () => {
    const { container } = renderMarkdown(
      '<a href="javascript:window.pwned=1">click</a>',
    );

    const href = container.querySelector("a")?.getAttribute("href") ?? "";

    expect(href.toLowerCase().startsWith("javascript:")).toBe(false);
  });
});
