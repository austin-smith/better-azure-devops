// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { RepositoryPullRequestFilesLayout } from "@/components/repositories/repository-pull-request-files-layout";

function renderLayout() {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );

  return render(
    <RepositoryPullRequestFilesLayout tree={<div>tree</div>}>
      <div>diffs</div>
    </RepositoryPullRequestFilesLayout>,
  );
}

describe("RepositoryPullRequestFilesLayout", () => {
  it("renders the tree before the diffs", () => {
    const { container } = renderLayout();
    const panels = [
      ...container.querySelectorAll('[data-slot="resizable-panel"]'),
    ];

    expect(panels).toHaveLength(2);
    expect(panels[0]?.textContent).toContain("tree");
    expect(panels[1]?.textContent).toContain("diffs");
  });

  /**
   * The group and its panels are given `overflow` by the panel library, which
   * makes them scrolling boxes and captures the file tree's sticky positioning,
   * leaving the tree to scroll away with the page instead of staying in view.
   *
   * Passing `overflow` through `style` currently wins, but the library documents
   * that property as one that cannot be overridden, so an upgrade could start
   * enforcing it. Nothing about that failure is visible in types or in the
   * rendered tree, so it is asserted here to fail loudly instead of silently
   * unpinning the tree.
   *
   * The supported alternative, a fixed-height group whose panels scroll
   * internally, was tried and reverted: it puts a second scrollbar inside the
   * page and changes how the whole view scrolls.
   */
  it("leaves the tree free of a scrolling ancestor so it can stay in view", () => {
    const { container } = renderLayout();
    const group = container.querySelector<HTMLElement>('[data-group="true"]');
    const treePanel = container.querySelector<HTMLElement>(
      '[data-slot="resizable-panel"]',
    );

    expect(group?.style.overflow).toBe("visible");
    expect(treePanel?.style.overflow).toBe("visible");
  });

  it("hides the tree when the toggle is pressed", async () => {
    const { container } = renderLayout();

    expect(
      container.querySelectorAll('[data-slot="resizable-panel"]'),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Hide file tree" }));

    expect(
      container.querySelectorAll('[data-slot="resizable-panel"]'),
    ).toHaveLength(0);
    expect(screen.getByText("diffs")).toBeDefined();
  });
});
