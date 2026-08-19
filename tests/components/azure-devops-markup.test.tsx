// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("expands markdown images in an accessible dialog", async () => {
    renderMarkdown("![a diagram](https://example.com/a.png)");

    const image = screen.getByRole("button", {
      name: "Expand image: a diagram",
    });

    expect(image).toHaveAttribute("aria-haspopup", "dialog");
    fireEvent.click(image);

    const dialog = screen.getByRole("dialog", {
      name: "a diagram",
    });

    expect(dialog).toHaveClass("w-fit");
    expect(dialog).not.toHaveClass("w-full");
    expect(dialog.className).not.toContain("100dvh-2rem");
    expect(dialog.querySelector('[data-slot="dialog-header"]'))
      .toHaveClass("pr-8");
    const footer = dialog.querySelector('[data-slot="dialog-footer"]');

    expect(footer).toHaveClass("p-2");
    expect(dialog.querySelectorAll('[data-slot="dialog-close"]'))
      .toHaveLength(2);
    expect(screen.getAllByAltText("a diagram")).toHaveLength(2);

    const closeButton = footer?.querySelector("button");

    if (!closeButton) {
      throw new Error("Expected the image dialog footer close button.");
    }

    expect(closeButton).toHaveClass("h-8");
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", {
        name: "a diagram",
      })).not.toBeInTheDocument();
    });
  });

  it("expands raw html images from the keyboard", () => {
    render(
      <AzureDevOpsMarkupView
        markup={{
          content: '<img src="https://example.com/shot.png" alt="shot" />',
          format: "html",
        }}
      />,
    );

    const image = screen.getByRole("button", {
      name: "Expand image: shot",
    });

    expect(image).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(image, { key: "Enter" });

    expect(
      screen.getByRole("dialog", { name: "shot" }),
    ).toBeInTheDocument();
  });

  it("preserves linked markdown image navigation", () => {
    renderMarkdown(
      "[![linked diagram](https://example.com/diagram.png)](https://example.com/docs)",
    );

    const link = screen.getByRole("link", { name: "linked diagram" });
    const image = screen.getByRole("img", { name: "linked diagram" });

    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(image).not.toHaveAttribute("aria-haspopup");
    expect(image).not.toHaveAttribute("role", "button");
    expect(image).not.toHaveAttribute("tabindex");

    expect(fireEvent.click(image)).toBe(true);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("preserves linked raw html image navigation", () => {
    render(
      <AzureDevOpsMarkupView
        markup={{
          content:
            '<a href="https://example.com/docs"><img src="https://example.com/shot.png" alt="linked shot"></a>',
          format: "html",
        }}
      />,
    );

    const link = screen.getByRole("link", { name: "linked shot" });
    const image = screen.getByRole("img", { name: "linked shot" });

    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(image).not.toHaveAttribute("aria-haspopup");
    expect(image).not.toHaveAttribute("role", "button");
    expect(image).not.toHaveAttribute("tabindex");

    expect(fireEvent.click(image)).toBe(true);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
