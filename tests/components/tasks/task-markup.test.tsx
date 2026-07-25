// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { TaskMarkup } from "@/components/tasks/task-markup";

describe("TaskMarkup", () => {
  it("keeps rendered markdown constrained inside its container", () => {
    render(
      <TaskMarkup
        markup={{
          content: "https://example.com/really/long/path/that/should/not/blow/out/layout",
          format: "markdown",
        }}
      />,
    );

    const wrapper = screen.getByText(
      "https://example.com/really/long/path/that/should/not/blow/out/layout",
    ).closest(".prose");

    expect(wrapper).toHaveClass("min-w-0", "overflow-x-auto", "break-words");
  });

  it("keeps unknown markup constrained inside its container", () => {
    render(
      <TaskMarkup
        markup={{
          content: "RAW_VALUE_WITH_A_REALLY_LONG_UNBROKEN_IDENTIFIER_THAT_SHOULD_NOT_OVERFLOW",
          format: "unknown",
        }}
      />,
    );

    expect(screen.getByText(
      "RAW_VALUE_WITH_A_REALLY_LONG_UNBROKEN_IDENTIFIER_THAT_SHOULD_NOT_OVERFLOW",
    )).toHaveClass("min-w-0", "overflow-x-auto", "break-words");
  });

  it("opens external markdown links in a new tab only for external urls", () => {
    render(
      <TaskMarkup
        markup={{
          content: [
            "[External](https://example.com)",
            "[Section](#section)",
            "[Relative](/docs)",
          ].join("\n\n"),
          format: "markdown",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute(
      "rel",
      "noreferrer noopener",
    );
    expect(screen.getByRole("link", { name: "Section" })).not.toHaveAttribute(
      "target",
    );
    expect(screen.getByRole("link", { name: "Relative" })).not.toHaveAttribute(
      "target",
    );
  });

  it("sanitizes HTML markup before rendering it", () => {
    const { container } = render(
      <TaskMarkup
        markup={{
          content: [
            '<p><a href="javascript:alert(1)" onclick="alert(1)">Unsafe link</a></p>',
            '<img alt="Bad image" src="javascript:alert(2)" onerror="alert(2)">',
            "<script>alert(3)</script>",
            "<style>body { display: none; }</style>",
            '<iframe src="https://example.com"></iframe>',
          ].join(""),
          format: "html",
        }}
      />,
    );

    const link = screen.getByText("Unsafe link").closest("a");
    const image = screen.getByRole("img", { name: "Bad image" });

    expect(link).not.toBeNull();
    expect(link).not.toHaveAttribute("href");
    expect(link).not.toHaveAttribute("onclick");
    expect(image).not.toHaveAttribute("src");
    expect(image).not.toHaveAttribute("onerror");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("keeps safe HTML description behavior at the render boundary", () => {
    render(
      <TaskMarkup
        markup={{
          content: [
            '<p>Ping <a data-vss-mention="aad,123" href="https://example.com/profile">Ada Lovelace</a></p>',
            '<p><a href="https://example.com">External</a></p>',
            '<p><img alt="Diagram" src="https://example.com/diagram.png"></p>',
            '<ul><li><input type="checkbox" checked> Done</li></ul>',
          ].join(""),
          format: "html",
        }}
      />,
    );

    const mention = screen.getByText("Ada Lovelace");
    const externalLink = screen.getByRole("link", { name: "External" });
    const image = screen.getByRole("img", { name: "Diagram" });
    const checkbox = screen.getByRole("checkbox");

    expect(mention.tagName).toBe("SPAN");
    expect(mention).toHaveAttribute("data-vss-mention", "aad,123");
    expect(externalLink).toHaveAttribute("target", "_blank");
    expect(externalLink).toHaveAttribute("rel", "noreferrer noopener");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(checkbox).toBeDisabled();
    expect(checkbox).toBeChecked();
  });

  it("renders Azure DevOps mention pseudo-links as non-link pills", () => {
    render(
      <TaskMarkup
        markup={{
          content: "Ping [Ada Lovelace](./ado-mention/123)",
          format: "markdown",
        }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Ada Lovelace" })).toBeNull();

    const mention = screen.getByText("Ada Lovelace");

    expect(mention.tagName).toBe("SPAN");
    expect(mention).toHaveAttribute("data-vss-mention", "123");
  });

  it("decodes encoded Azure DevOps mention ids on pseudo-link pills", () => {
    render(
      <TaskMarkup
        markup={{
          content: "Ping [Ada Lovelace](./ado-mention/team%2Fproject%20member)",
          format: "markdown",
        }}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toHaveAttribute(
      "data-vss-mention",
      "team/project member",
    );
  });

  it("loads markdown preview images lazily", () => {
    render(
      <TaskMarkup
        markup={{
          content: "![Architecture diagram](https://example.com/diagram.png)",
          format: "markdown",
        }}
      />,
    );

    const image = screen.getByRole("img", { name: "Architecture diagram" });

    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("keeps markdown task checkboxes read-only by default", () => {
    render(
      <TaskMarkup
        markup={{
          content: "- [ ] Ship editor",
          format: "markdown",
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Ship editor" })).toBeDisabled();
  });

  it("uses task text as checkbox labels when editing is enabled", () => {
    const onTaskCheckedChange = vi.fn();

    render(
      <TaskMarkup
        markup={{
          content: "- [ ] Ship editor",
          format: "markdown",
        }}
        onTaskCheckedChange={onTaskCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Ship editor" });

    expect(checkbox).not.toBeDisabled();

    fireEvent.click(checkbox);

    expect(onTaskCheckedChange).toHaveBeenCalledWith(0, true);
  });

  it("uses formatted task text as checkbox labels", () => {
    render(
      <TaskMarkup
        markup={{
          content: "- [ ] Ship **markdown** editor",
          format: "markdown",
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Ship markdown editor" }))
      .toBeDisabled();
  });

  it("uses task image alt text as checkbox labels", () => {
    render(
      <TaskMarkup
        markup={{
          content: "- [ ] ![Architecture diagram](https://example.com/diagram.png)",
          format: "markdown",
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Architecture diagram" }))
      .toBeDisabled();
  });

  it("renders nested markdown task checkboxes", () => {
    const onTaskCheckedChange = vi.fn();

    render(
      <TaskMarkup
        markup={{
          content: [
            "- [ ] Parent task",
            "    - [ ] Nested task",
          ].join("\n"),
          format: "markdown",
        }}
        onTaskCheckedChange={onTaskCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Nested task" }));

    expect(screen.getByRole("checkbox", { name: "Parent task" }))
      .toBeInTheDocument();
    expect(onTaskCheckedChange).toHaveBeenCalledWith(1, true);
  });

  it("renders nested markdown task checkboxes after parent continuation text", () => {
    const onTaskCheckedChange = vi.fn();

    render(
      <TaskMarkup
        markup={{
          content: [
            "- [ ] Parent task",
            "  Parent details",
            "    - [ ] Nested task",
          ].join("\n"),
          format: "markdown",
        }}
        onTaskCheckedChange={onTaskCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Nested task" }));

    expect(screen.getByRole("checkbox", { name: "Parent task Parent details" }))
      .toBeInTheDocument();
    expect(onTaskCheckedChange).toHaveBeenCalledWith(1, true);
  });

  it("reports quoted task checkbox changes when editing is enabled", () => {
    const onTaskCheckedChange = vi.fn();

    render(
      <TaskMarkup
        markup={{
          content: "> - [ ] Ship editor",
          format: "markdown",
        }}
        onTaskCheckedChange={onTaskCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Ship editor" }));

    expect(onTaskCheckedChange).toHaveBeenCalledWith(0, true);
  });

  it("does not expose task checkboxes from quoted fenced code", () => {
    const onTaskCheckedChange = vi.fn();

    render(
      <TaskMarkup
        markup={{
          content: [
            "> ```",
            "> - [ ] Example inside code",
            "> ```",
            "> - [ ] Real task",
          ].join("\n"),
          format: "markdown",
        }}
        onTaskCheckedChange={onTaskCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Real task" }));

    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(onTaskCheckedChange).toHaveBeenCalledWith(0, true);
  });

  it("does not expose task checkboxes from indented code", () => {
    render(
      <TaskMarkup
        markup={{
          content: [
            "    - [ ] Example inside code",
            "",
            "- [ ] Real task",
          ].join("\n"),
          format: "markdown",
        }}
        onTaskCheckedChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox", {
      name: "Example inside code",
    })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Real task" }))
      .toBeInTheDocument();
  });

  it("does not expose task checkboxes from quoted indented code", () => {
    render(
      <TaskMarkup
        markup={{
          content: [
            ">     - [ ] Example inside quoted code",
            "",
            "- [ ] Real task",
          ].join("\n"),
          format: "markdown",
        }}
        onTaskCheckedChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox", {
      name: "Example inside quoted code",
    })).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Real task" }))
      .toBeInTheDocument();
  });
});
