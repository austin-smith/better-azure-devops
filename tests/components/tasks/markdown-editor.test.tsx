// @vitest-environment jsdom

import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { MarkdownEditor } from "@/components/tasks/markdown-editor";

const markdownEditorPreferencesKey =
  "better-azure-devops.markdown-editor.preferences.v1";
const markdownEditorSplitLayoutKey =
  "better-azure-devops.markdown-editor.split-layout.v1";

vi.mock("@/components/tasks/task-markup", () => ({
  TaskMarkup: ({
    markup,
    onTaskCheckedChange,
  }: {
    markup?: {
      content: string;
    } | null;
    onTaskCheckedChange?: (taskIndex: number, checked: boolean) => void;
  }) => (
    <div data-testid="markdown-preview">
      {markup?.content ?? null}
      {onTaskCheckedChange ? (
        <>
          <button
            onClick={() => onTaskCheckedChange(0, true)}
            type="button"
          >
            Complete task
          </button>
          <button
            onClick={() => onTaskCheckedChange(1, true)}
            type="button"
          >
            Complete second task
          </button>
        </>
      ) : null}
    </div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    render,
  }: {
    children: ReactNode;
    render: ReactElement;
  }) => cloneElement(render, {}, children),
}));

class TestResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

function createEmptyClientRectList() {
  return {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterateClientRects() {},
  } as DOMRectList;
}

function createTestStorage() {
  const values = new Map<string, string>();

  return {
    clear: vi.fn(() => {
      values.clear();
    }),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    get length() {
      return values.size;
    },
  } satisfies Storage;
}

function getEditorView() {
  const editorElement = screen.getByLabelText("Markdown content") as HTMLElement & {
    cmTile?: {
      view?: EditorView;
    };
  };
  const view = editorElement.cmTile?.view;

  if (!view) {
    throw new Error("CodeMirror editor view was not available");
  }

  return view;
}

function defineScrollMetrics(
  element: HTMLElement,
  metrics: {
    clientHeight: number;
    scrollHeight: number;
  },
) {
  Object.defineProperties(element, {
    clientHeight: {
      configurable: true,
      value: metrics.clientHeight,
    },
    scrollHeight: {
      configurable: true,
      value: metrics.scrollHeight,
    },
  });
}

describe("MarkdownEditor", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createTestStorage(),
    });
    window.localStorage.clear();
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    Object.defineProperty(window.Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 0, 0),
    });
    Object.defineProperty(window.Range.prototype, "getClientRects", {
      configurable: true,
      value: createEmptyClientRectList,
    });
  });

  afterEach(() => {
    document.body.style.overflow = "";
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("starts in split mode with editor and preview available", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    expect(screen.queryByRole("button", { name: "Write" })).not.toBeInTheDocument();
    for (const modeName of ["Edit", "Split", "Preview"]) {
      expect(
        screen.getByRole("button", { name: modeName })
          .querySelector('[data-icon="inline-start"]'),
      ).toBeInTheDocument();
    }
    for (const [modeName, description] of [
      ["Edit", "Edit markdown only"],
      ["Split", "Edit and preview side by side"],
      ["Preview", "Preview rendered content only"],
    ] as const) {
      const modeButton = screen.getByRole("button", { name: modeName });
      const descriptionId = modeButton.getAttribute("aria-describedby");

      expect(descriptionId).toBeTruthy();
      expect(descriptionId ? document.getElementById(descriptionId) : null)
        .toHaveTextContent(description);
      expect(modeButton).toHaveAccessibleDescription(description);
      expect(modeButton).not.toHaveAttribute("title");
    }
    expect(screen.getByRole("toolbar", { name: "Markdown formatting" }))
      .toBeInTheDocument();
    for (const groupName of [
      "Block style",
      "Inline formatting",
      "Lists and quotes",
      "Insert tools",
    ]) {
      expect(
        within(screen.getByRole("toolbar", { name: "Markdown formatting" }))
          .getByRole("group", { name: groupName }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("toolbar", { name: "Markdown formatting" }).parentElement)
      .toHaveClass("lg:flex-wrap");
    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-preview")).toHaveTextContent("**Hello**");
    expect(screen.getByRole("region", { name: "Markdown preview" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("separator", {
        name: "Resize editor and preview panes",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", {
        name: "Resize editor and preview panes",
      }),
    ).toHaveClass("after:w-3");
    expect(screen.getByTestId("markdown-editor-layout")).toContainElement(
      screen.getByTestId("markdown-preview-pane"),
    );
    expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not expose decorative toolbar dividers as separators", () => {
    const { container } = render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    const toolbar = screen.getByRole("toolbar", { name: "Markdown formatting" });

    expect(within(toolbar).queryAllByRole("separator")).toHaveLength(0);
    for (const divider of container.querySelectorAll('[data-slot="separator"]')) {
      expect(divider).toHaveAttribute("role", "presentation");
    }
    expect(
      screen.getByRole("separator", {
        name: "Resize editor and preview panes",
      }),
    ).toBeInTheDocument();
  });

  it("uses a visible focus treatment on the editor pane", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    const editorPane = screen.getByLabelText("Markdown content")
      .closest(".cm-editor")
      ?.parentElement;

    expect(editorPane).toHaveClass("focus-within:ring-[3px]");
    expect(editorPane).toHaveClass("focus-within:ring-ring/50");
  });

  it("bounds the editor workspace height so long descriptions scroll inside it", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    expect(screen.getByTestId("markdown-editor-layout")).toHaveClass(
      "h-[clamp(28rem,70vh,56rem)]",
    );
    expect(screen.getByLabelText("Markdown content").closest(".cm-editor")?.parentElement)
      .toHaveClass("h-full");
    expect(screen.getByTestId("markdown-preview-pane")).toHaveClass("h-full");
    expect(screen.getByTestId("markdown-preview-pane")).toHaveClass("overflow-auto");
  });

  it("uses the shared empty state component for blank previews", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    const emptyPreview = screen.getByText("Nothing to preview.")
      .closest('[data-slot="empty"]');

    expect(emptyPreview).toBeInTheDocument();
    expect(emptyPreview).toHaveClass("h-full");
    expect(emptyPreview).toHaveClass("min-h-full");
    expect(emptyPreview).not.toHaveClass("flex-none");
  });

  it("enables prose-friendly typing assistance on the markdown input", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Description text" />);

    const editorInput = screen.getByLabelText("Markdown content");

    expect(screen.getByRole("textbox", { name: "Markdown content" }))
      .toBe(editorInput);
    expect(editorInput).toHaveAttribute("aria-multiline", "true");
    expect(editorInput).toHaveAttribute("aria-readonly", "false");
    expect(editorInput).toHaveAttribute("spellcheck", "true");
    expect(editorInput).toHaveAttribute("autocorrect", "on");
    expect(editorInput).toHaveAttribute("autocapitalize", "sentences");
  });

  it("allows callers to name the markdown input for its editing context", () => {
    render(
      <MarkdownEditor
        ariaLabel="Description markdown content"
        onChange={vi.fn()}
        value="Description text"
      />,
    );

    expect(screen.getByRole("textbox", { name: "Description markdown content" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Markdown content" }))
      .not.toBeInTheDocument();
  });

  it("allows callers to name the markdown preview for its editing context", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        previewAriaLabel="Description markdown preview"
        value="Description text"
      />,
    );

    expect(screen.getByRole("region", { name: "Description markdown preview" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Markdown preview" }))
      .not.toBeInTheDocument();
  });

  it("allows callers to name markdown controls for their editing context", () => {
    render(
      <MarkdownEditor
        modeAriaLabel="Description markdown editor mode"
        onChange={vi.fn()}
        statisticsAriaLabel="Description markdown statistics"
        toolbarAriaLabel="Description markdown formatting"
        value="Description text"
      />,
    );

    expect(screen.getByRole("toolbar", { name: "Description markdown formatting" }))
      .toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Description markdown editor mode" }))
      .toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Description markdown statistics" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Markdown formatting" }))
      .not.toBeInTheDocument();
  });

  it("exposes disabled editing state on the markdown input", () => {
    render(<MarkdownEditor disabled onChange={vi.fn()} value="Description text" />);

    expect(screen.getByLabelText("Markdown content")).toHaveAttribute(
      "aria-readonly",
      "true",
    );
  });

  it("does not visually disable the whole editor shell when editing is disabled", () => {
    const { container } = render(
      <MarkdownEditor disabled onChange={vi.fn()} value="Description text" />,
    );

    expect(container.firstChild).not.toHaveClass("opacity-80");
  });

  it("exposes non-live markdown statistics in the editor footer", () => {
    render(<MarkdownEditor onChange={vi.fn()} value={"First line\nSecond line"} />);

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("2 lines · 4 words · 22 characters");
  });

  it("keeps duplicate mode and wrap state out of the footer", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Description text" />);

    expect(screen.queryByRole("group", { name: /^Markdown editor status:/u }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Editable")).not.toBeInTheDocument();
    expect(screen.queryByText("Wrap on")).not.toBeInTheDocument();
    expect(screen.queryByText("Wrap off")).not.toBeInTheDocument();
  });

  it("does not add read-only footer chrome when disabled", () => {
    render(<MarkdownEditor disabled onChange={vi.fn()} value="Description text" />);

    expect(screen.queryByText("Read-only")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toBeInTheDocument();
  });

  it("counts readable markdown words and characters instead of syntax markers", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={"- [ ] Ship **markdown** editor\n[Docs](https://example.com)"}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("2 lines · 4 words · 25 characters");
  });

  it("does not count markdown table pipes as words", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "| Name | Status |",
          "| --- | --- |",
          "| Editor | Ready |",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("3 lines · 4 words");
  });

  it("counts link labels without counting parenthesized destinations", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "[Spec](https://example.com/docs/(draft))",
          "![Architecture diagram](<https://example.com/assets/(draft).png>)",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("2 lines · 3 words");
  });

  it("counts fenced code content without counting fence language markers", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "```ts",
          "const value = true",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("3 lines · 4 words");
  });

  it("does not count horizontal rule marker lines as words", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "Before",
          "---",
          "> ***",
          "After",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("4 lines · 2 words");
  });

  it("does not count raw html skipped by the markdown preview as readable words", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value="Visible <span>hidden html words</span> <br /> done"
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("1 line · 2 words");
  });

  it("does not count multi-line raw html skipped by the markdown preview", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "Visible",
          "<div>hidden opening text",
          "hidden html words",
          "</div>",
          "done",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("5 lines · 2 words");
  });

  it("counts raw html inside fenced code because the preview renders it as code", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={[
          "```html",
          "<span>visible code words</span>",
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByRole("group", { name: "Markdown statistics" }))
      .toHaveTextContent("3 lines · 3 words");
  });

  it("loads persisted split layout with sane pane limits", () => {
    window.localStorage.setItem(
      markdownEditorSplitLayoutKey,
      JSON.stringify({
        editor: 95,
        preview: 5,
      }),
    );

    render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    expect(screen.getByTestId("editor")).toHaveStyle({
      flex: "70 1 0px",
    });
    expect(screen.getByTestId("preview")).toHaveStyle({
      flex: "30 1 0px",
    });
  });

  it("ignores unusable persisted split layouts", () => {
    window.localStorage.setItem(
      markdownEditorSplitLayoutKey,
      JSON.stringify({
        editor: 0,
        preview: 0,
      }),
    );

    render(<MarkdownEditor onChange={vi.fn()} value="**Hello**" />);

    expect(screen.getByTestId("editor")).toHaveStyle({
      flex: "50 1 0px",
    });
    expect(screen.getByTestId("preview")).toHaveStyle({
      flex: "50 1 0px",
    });
  });

  it("does not report external value updates as editor changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MarkdownEditor onChange={onChange} value="Original" />,
    );

    rerender(<MarkdownEditor onChange={onChange} value="Remote update" />);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Markdown content")).toHaveTextContent(
      "Remote update",
    );
  });

  it("preserves active selection across external value updates", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MarkdownEditor onChange={onChange} value="Original" />,
    );

    getEditorView().dispatch({
      selection: EditorSelection.range(0, "Original".length),
    });
    rerender(<MarkdownEditor onChange={onChange} value="Updated" />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenLastCalledWith("**Updated**");
  });

  it("resets stale editor history after external value updates", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<MarkdownEditor onChange={onChange} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    });

    rerender(<MarkdownEditor onChange={onChange} value="Remote update" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    });
    expect(screen.getByLabelText("Markdown content")).toHaveTextContent(
      "Remote update",
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reports toolbar edits as editor changes", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenCalledWith("**strong text**");
  });

  it("keeps editor focus after formatting toolbar actions", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(screen.getByLabelText("Markdown content")).toHaveFocus();
  });

  it("keeps mouse toolbar presses from stealing the editor selection", () => {
    render(<MarkdownEditor autoFocus onChange={vi.fn()} value="Selected text" />);

    const mouseDownEvent = createEvent.mouseDown(
      screen.getByRole("button", { name: "Bold" }),
    );

    fireEvent(screen.getByRole("button", { name: "Bold" }), mouseDownEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
  });

  it("keeps editor focus after changing editor display options", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Disable line wrap" }));

    expect(screen.getByLabelText("Markdown content")).toHaveFocus();
  });

  it("places the cursor at the end when opening directly into editing", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor autoFocus onChange={onChange} value="Existing text" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Markdown content")).toHaveFocus();
    });

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenCalledWith("Existing text**strong text**");
  });

  it("uses the shared button icon convention across editor controls", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    for (const name of [
      "Bold",
      "Undo",
      "Redo",
      "Disable line wrap",
      "Edit",
      "Split",
      "Preview",
    ]) {
      const icon = screen.getByRole("button", { name }).querySelector("svg");

      expect(icon).toHaveAttribute("data-icon", "inline-start");
    }
  });

  it("exposes the link keyboard shortcut on the toolbar control", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    expect(screen.getByRole("button", { name: "Link" })).toHaveAttribute(
      "aria-keyshortcuts",
      "Meta+K Control+K",
    );
  });

  it("omits inactive pressed state for insert-only toolbar controls", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Link" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Image" }))
      .not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Table" }))
      .not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("button", { name: "Horizontal rule" }))
      .not.toHaveAttribute("aria-pressed");
  });

  it("does not mark insert controls active at syntax boundaries", async () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value="![Architecture diagram](https://example.com/diagram.png)"
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Image" }))
        .not.toHaveAttribute("aria-pressed");
    });
  });

  it("disables undo and redo when the editor history cannot use them", async () => {
    render(<MarkdownEditor onChange={vi.fn()} value="" />);

    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    });
  });

  it("reports block insertions from the toolbar", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Horizontal rule" }));

    expect(onChange).toHaveBeenCalledWith("---");
  });

  it("inserts image markdown from the toolbar", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="" />);

    fireEvent.click(screen.getByRole("button", { name: "Image" }));

    expect(onChange).toHaveBeenCalledWith("![image description](https://)");
  });

  it("marks the active block format in the toolbar", async () => {
    render(<MarkdownEditor onChange={vi.fn()} value="## Heading" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Heading 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Paragraph" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("keeps code block context from applying other toolbar formatting", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value={"```\ncode\n```"} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Code block" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Code block" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("switches between editor and preview modes without losing the value", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByLabelText("Markdown content").closest("[hidden]")).not.toBeNull();
    expect(screen.getByTestId("markdown-preview")).toHaveTextContent(
      "- [ ] Ship editor",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    expect(screen.queryByTestId("markdown-preview")).not.toBeInTheDocument();
  });

  it("focuses the editor after explicitly switching back to an editing mode", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByLabelText("Markdown content")).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Markdown content")).toHaveFocus();
  });

  it("focuses the editor after explicitly switching to split mode", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    expect(screen.getByLabelText("Markdown content")).toHaveFocus();
    expect(screen.getByTestId("markdown-preview")).toBeInTheDocument();
  });

  it("does not queue editor focus after mode changes while disabled", () => {
    const { rerender } = render(
      <MarkdownEditor disabled onChange={vi.fn()} value="- [ ] Ship editor" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText("Markdown content")).not.toHaveFocus();

    rerender(<MarkdownEditor onChange={vi.fn()} value="- [ ] Ship editor" />);

    expect(screen.getByLabelText("Markdown content")).not.toHaveFocus();
  });

  it("keeps split editor and preview scrolling together", () => {
    render(
      <MarkdownEditor
        onChange={vi.fn()}
        value={Array.from({ length: 60 }, (_, index) => `Line ${index + 1}`).join("\n")}
      />,
    );

    const editorScroller = screen
      .getByLabelText("Markdown content")
      .closest(".cm-editor")
      ?.querySelector(".cm-scroller");
    const previewScroller = screen.getByTestId("markdown-preview-pane");

    expect(editorScroller).toBeInstanceOf(HTMLElement);
    defineScrollMetrics(editorScroller as HTMLElement, {
      clientHeight: 250,
      scrollHeight: 1000,
    });
    defineScrollMetrics(previewScroller, {
      clientHeight: 500,
      scrollHeight: 2000,
    });

    (editorScroller as HTMLElement).scrollTop = 375;
    fireEvent.scroll(editorScroller as HTMLElement);

    expect(previewScroller.scrollTop).toBe(750);

    previewScroller.scrollTop = 500;
    fireEvent.scroll(previewScroller);

    expect((editorScroller as HTMLElement).scrollTop).toBe(250);
  });

  it("hides editing controls in preview mode", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Preview body" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Disable line wrap" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Markdown formatting" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Markdown preview" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Split" })).toBeInTheDocument();
  });

  it("updates task list items from preview checkboxes", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith("- [x] Ship editor");
  });

  it("updates nested task list items from preview checkboxes", () => {
    const onChange = vi.fn();
    const value = [
      "- [ ] Parent task",
      "    - [ ] Nested task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete second task" }));

    expect(onChange).toHaveBeenCalledWith([
      "- [ ] Parent task",
      "    - [x] Nested task",
    ].join("\n"));
  });

  it("updates nested task list items after parent continuation text", () => {
    const onChange = vi.fn();
    const value = [
      "- [ ] Parent task",
      "  Parent details",
      "    - [ ] Nested task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete second task" }));

    expect(onChange).toHaveBeenCalledWith([
      "- [ ] Parent task",
      "  Parent details",
      "    - [x] Nested task",
    ].join("\n"));
  });

  it("does not map preview task checkbox edits to fenced code samples", () => {
    const onChange = vi.fn();
    const value = [
      "```",
      "- [ ] Example inside code",
      "```",
      "",
      "- [ ] Real task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith([
      "```",
      "- [ ] Example inside code",
      "```",
      "",
      "- [x] Real task",
    ].join("\n"));
  });

  it("does not map preview task checkbox edits to indented code samples", () => {
    const onChange = vi.fn();
    const value = [
      "    - [ ] Example inside code",
      "",
      "- [ ] Real task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith([
      "    - [ ] Example inside code",
      "",
      "- [x] Real task",
    ].join("\n"));
  });

  it("does not map preview task checkbox edits to quoted indented code samples", () => {
    const onChange = vi.fn();
    const value = [
      "- [ ] Parent task",
      ">     - [ ] Example inside quoted code",
      "",
      "- [ ] Real task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete second task" }));

    expect(onChange).toHaveBeenCalledWith([
      "- [ ] Parent task",
      ">     - [ ] Example inside quoted code",
      "",
      "- [x] Real task",
    ].join("\n"));
  });

  it("does not map preview task checkbox edits to quoted fenced code samples", () => {
    const onChange = vi.fn();
    const value = [
      "> ```",
      "> - [ ] Example inside code",
      "> ```",
      "> - [ ] Real task",
    ].join("\n");

    render(<MarkdownEditor onChange={onChange} value={value} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith([
      "> ```",
      "> - [ ] Example inside code",
      "> ```",
      "> - [x] Real task",
    ].join("\n"));
  });

  it("updates ordered task list items from preview checkboxes", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="1. [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith("1. [x] Ship editor");
  });

  it("updates quoted task list items from preview checkboxes", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="> - [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith("> - [x] Ship editor");
  });

  it("updates task list items from preview-only mode checkboxes", () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    expect(onChange).toHaveBeenCalledWith("- [x] Ship editor");
  });

  it("keeps preview-only task checkbox edits in editor history", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "- [x] Ship editor");
    expect(onChange).toHaveBeenNthCalledWith(2, "- [ ] Ship editor");
  });

  it("keeps preview task checkboxes read-only when disabled", () => {
    const onChange = vi.fn();

    render(
      <MarkdownEditor
        disabled
        onChange={onChange}
        value="- [ ] Ship editor"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Complete task" }),
    ).not.toBeInTheDocument();
  });

  it("keeps display controls available without disabled formatting clutter", () => {
    render(
      <MarkdownEditor
        disabled
        onChange={vi.fn()}
        value="Body"
      />,
    );

    expect(screen.queryByRole("toolbar", { name: "Markdown formatting" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();

    const wrapButton = screen.getByRole("button", {
      name: "Disable line wrap",
    });

    fireEvent.click(wrapButton);

    expect(
      screen.getByRole("button", { name: "Enable line wrap" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Markdown content")).not.toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps preview task checkbox edits in editor history", async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor onChange={onChange} value="- [ ] Ship editor" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onChange).toHaveBeenNthCalledWith(1, "- [x] Ship editor");
    expect(onChange).toHaveBeenNthCalledWith(2, "- [ ] Ship editor");
  });

  it("keeps editor controls focused on markdown editing", () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Body" />);

    const wrapButton = screen.getByRole("button", {
      name: "Disable line wrap",
    });

    fireEvent.click(wrapButton);

    expect(
      screen.getByRole("button", { name: "Enable line wrap" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Search markdown" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use expanded editor height" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Use focus mode" }),
    ).not.toBeInTheDocument();
  });

  it("loads persisted editing preferences", async () => {
    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify({
        mode: "preview",
        wrapLines: false,
      }),
    );

    render(<MarkdownEditor onChange={vi.fn()} value="Persisted body" />);

    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("markdown-preview")).toHaveTextContent(
      "Persisted body",
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("button", { name: "Enable line wrap" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("migrates the previous write mode preference to editor", async () => {
    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify({
        mode: "write",
        wrapLines: true,
      }),
    );

    render(<MarkdownEditor onChange={vi.fn()} value="Persisted body" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "editor",
        wrapLines: true,
      });
    });
  });

  it("persists editor mode with the user-facing mode name", async () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Body" />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "editor",
        wrapLines: true,
      });
    });
  });

  it("opens with editor focus when explicitly requested", async () => {
    render(<MarkdownEditor autoFocus onChange={vi.fn()} value="Focused body" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Markdown content")).toHaveFocus();
    });
  });

  it("keeps the editor visible on explicit focus entry even when preview was persisted", async () => {
    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify({
        mode: "preview",
        wrapLines: true,
      }),
    );

    render(<MarkdownEditor autoFocus onChange={vi.fn()} value="Focused body" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    expect(screen.getByTestId("markdown-preview")).toHaveTextContent(
      "Focused body",
    );
    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "preview",
        wrapLines: true,
      });
    });
  });

  it("opens in edit mode on compact focused entry so the writing pane stays usable", async () => {
    vi.stubGlobal("innerWidth", 390);

    render(<MarkdownEditor autoFocus onChange={vi.fn()} value="Focused body" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Markdown preview" }))
      .not.toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "split",
        wrapLines: true,
      });
    });
  });

  it("keeps a persisted preview preference while opening compact focused entry in edit mode", async () => {
    vi.stubGlobal("innerWidth", 390);
    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify({
        mode: "preview",
        wrapLines: true,
      }),
    );

    render(<MarkdownEditor autoFocus onChange={vi.fn()} value="Focused body" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "preview",
        wrapLines: true,
      });
    });
  });

  it("places the cursor at the end on explicit focus entry when preview was persisted", async () => {
    const onChange = vi.fn();

    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify({
        mode: "preview",
        wrapLines: true,
      }),
    );

    render(
      <MarkdownEditor autoFocus onChange={onChange} value="Persisted body" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Split" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenCalledWith("Persisted body**strong text**");
  });

  it("persists editing preference changes", async () => {
    render(<MarkdownEditor onChange={vi.fn()} value="Body" />);

    fireEvent.click(screen.getByRole("button", { name: "Disable line wrap" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() => {
      expect(JSON.parse(
        window.localStorage.getItem(markdownEditorPreferencesKey) ?? "{}",
      )).toEqual({
        mode: "preview",
        wrapLines: false,
      });
    });
  });
});
