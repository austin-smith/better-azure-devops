"use client";

import {
  BoldIcon,
  BracesIcon,
  CodeIcon,
  Columns2Icon,
  EyeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PencilLineIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  TableIcon,
  Undo2Icon,
  WrapTextIcon,
  type LucideIcon,
} from "lucide-react";
import { redo, redoDepth, undo, undoDepth } from "@codemirror/commands";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, placeholder, type ViewUpdate } from "@codemirror/view";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getActiveMarkdownCommands,
  type MarkdownCommandName,
  runMarkdownCommand,
} from "./commands";
import {
  markdownEditorBaseExtensions,
} from "./extensions";
import { ModifierKeyKbd } from "@/components/modifier-key-kbd";
import { TaskMarkup } from "@/components/tasks/task-markup";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type MarkdownEditorMode = "editor" | "split" | "preview";

type MarkdownEditorProps = {
  ariaLabel?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  modeAriaLabel?: string;
  placeholder?: string;
  previewAriaLabel?: string;
  statisticsAriaLabel?: string;
  toolbarAriaLabel?: string;
  value: string;
};

type ToolbarAction = {
  command: MarkdownCommandName;
  icon: LucideIcon;
  isInsertAction?: boolean;
  label: string;
  shortcut?: "link";
};

type ToolbarActionGroup = {
  actions: ToolbarAction[];
  label: string;
};

type MarkdownEditorPreferences = {
  mode: MarkdownEditorMode;
  wrapLines: boolean;
};

type MarkdownEditorHistoryDepths = {
  redo: number;
  undo: number;
};

type MarkdownEditorSplitLayout = {
  editor: number;
  preview: number;
};

const defaultMarkdownEditorSplitLayout = {
  editor: 50,
  preview: 50,
} satisfies MarkdownEditorSplitLayout;
const markdownEditorPreferencesKey =
  "better-azure-devops.markdown-editor.preferences.v1";
const markdownEditorSplitLayoutKey =
  "better-azure-devops.markdown-editor.split-layout.v1";
const markdownEditorInputPaneClassName =
  "h-full min-h-0 focus-within:relative focus-within:z-10 focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:ring-inset";
const markdownEditorSurfaceClassName = "h-[clamp(28rem,70vh,56rem)]";
const minimumMarkdownEditorSplitPaneSize = 30;
const compactMarkdownEditorViewportWidth = 640;
const taskListItemPattern =
  /^((?:\s*>\s?)*\s*(?:[-*+]|\d+\.)\s+\[)[ xX](](?:\s+|$))/;
const markdownListItemIndentPattern =
  /^((?:\s*>\s?)*)([ \t]*)(?:[-*+]|\d+\.)\s+/;
const markdownIndentedLinePattern =
  /^((?:\s*>\s?)*)([ \t]*)\S/;
const fencedCodeBoundaryPattern =
  /^(?:\s*>\s?)* {0,3}(`{3,}|~{3,})(.*)$/;
const indentedCodeTaskListItemPattern =
  /^(?:\s*>\s?)*(?: {4,}|\t)(?:[-*+]|\d+\.)\s+\[[ xX]\](?:\s+|$)/;

const markdownEditorModeConfig = {
  editor: {
    description: "Edit markdown only",
    icon: PencilLineIcon,
    label: "Edit",
  },
  preview: {
    description: "Preview rendered content only",
    icon: EyeIcon,
    label: "Preview",
  },
  split: {
    description: "Edit and preview side by side",
    icon: Columns2Icon,
    label: "Split",
  },
} satisfies Record<
  MarkdownEditorMode,
  { description: string; icon: LucideIcon; label: string }
>;
const markdownEditorModeOrder: MarkdownEditorMode[] = ["editor", "split", "preview"];

const toolbarGroups: ToolbarActionGroup[] = [
  {
    label: "Block style",
    actions: [
      { command: "paragraph", icon: PilcrowIcon, label: "Paragraph" },
      { command: "heading1", icon: Heading1Icon, label: "Heading 1" },
      { command: "heading2", icon: Heading2Icon, label: "Heading 2" },
      { command: "heading3", icon: Heading3Icon, label: "Heading 3" },
    ],
  },
  {
    label: "Inline formatting",
    actions: [
      { command: "bold", icon: BoldIcon, label: "Bold" },
      { command: "italic", icon: ItalicIcon, label: "Italic" },
      { command: "strikethrough", icon: StrikethroughIcon, label: "Strikethrough" },
      { command: "inlineCode", icon: CodeIcon, label: "Inline code" },
    ],
  },
  {
    label: "Lists and quotes",
    actions: [
      { command: "quote", icon: QuoteIcon, label: "Quote" },
      { command: "bulletList", icon: ListIcon, label: "Bulleted list" },
      { command: "orderedList", icon: ListOrderedIcon, label: "Numbered list" },
      { command: "taskList", icon: ListTodoIcon, label: "Task list" },
    ],
  },
  {
    label: "Insert tools",
    actions: [
      { command: "link", icon: LinkIcon, label: "Link", shortcut: "link" },
      { command: "image", icon: ImageIcon, isInsertAction: true, label: "Image" },
      { command: "codeBlock", icon: BracesIcon, label: "Code block" },
      { command: "table", icon: TableIcon, isInsertAction: true, label: "Table" },
      {
        command: "horizontalRule",
        icon: MinusIcon,
        isInsertAction: true,
        label: "Horizontal rule",
      },
    ],
  },
];

function ShortcutHint({ shortcut }: { shortcut: ToolbarAction["shortcut"] }) {
  if (!shortcut) {
    return null;
  }

  return (
    <KbdGroup>
      <ModifierKeyKbd />
      <Kbd>K</Kbd>
    </KbdGroup>
  );
}

function stripReadableMarkdownStatsSyntax(line: string, stripRawHtml: boolean) {
  let readableLine = line
    .replace(/!\[([^\]]*)\]\((?:<[^>]*>|(?:\\.|[^()\\]|\([^()]*\))*)\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\((?:<[^>]*>|(?:\\.|[^()\\]|\([^()]*\))*)\)/g, " $1 ");

  if (stripRawHtml) {
    readableLine = readableLine
      .replace(/<([A-Za-z][\w:-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g, " ")
      .replace(/<\/?[A-Za-z][^>]*>/g, " ");
  }

  return readableLine
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/, " ")
    .replace(/^((?:\s*>\s?)*\s{0,3})(?:-{3,}|\*{3,}|_{3,})\s*$/, "$1")
    .replace(/^((?:\s*>\s?)*)\s*#{1,6}\s+/, "$1")
    .replace(/^((?:\s*>\s?)*)\s*(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*/, "$1")
    .replace(/^((?:\s*>\s?)*)\s*(?:[-*+]|\d+\.)\s+/, "$1")
    .replace(/^\s*>\s?/, "")
    .replace(/[|`*_~]/g, " ");
}

function readableMarkdownStatsValue(value: string) {
  let fencedCode:
    | {
        marker: "`" | "~";
        size: number;
      }
    | null = null;
  let rawHtmlBlockTag: string | null = null;

  return value.split("\n").map((line) => {
    const fenceMatch = line.match(fencedCodeBoundaryPattern);

    if (fencedCode) {
      const fence = fenceMatch?.[1] ?? "";
      const remainder = fenceMatch?.[2] ?? "";

      if (
        fence[0] === fencedCode.marker &&
        fence.length >= fencedCode.size &&
        /^\s*$/.test(remainder)
      ) {
        fencedCode = null;
        return " ";
      }

      return stripReadableMarkdownStatsSyntax(line, false);
    }

    if (rawHtmlBlockTag) {
      if (new RegExp(`</${rawHtmlBlockTag}\\s*>`, "i").test(line)) {
        rawHtmlBlockTag = null;
      }

      return " ";
    }

    if (fenceMatch) {
      const fence = fenceMatch[1] ?? "";
      const marker = fence[0] as "`" | "~";
      const remainder = fenceMatch[2] ?? "";

      if (marker !== "`" || !remainder.includes("`")) {
        fencedCode = {
          marker,
          size: fence.length,
        };
        return " ";
      }
    }

    const rawHtmlBlockMatch = line.match(
      /^\s*(?:>\s?)*<([A-Za-z][\w:-]*)(?:\s[^>]*)?>(?![\s\S]*<\/\1\s*>)/i,
    );

    if (rawHtmlBlockMatch) {
      rawHtmlBlockTag = rawHtmlBlockMatch[1]?.toLowerCase() ?? null;
      return " ";
    }

    return stripReadableMarkdownStatsSyntax(line, true);
  }).join("\n");
}

function getMarkdownStats(value: string) {
  const readableValue = readableMarkdownStatsValue(value);
  const trimmedReadableValue = readableValue.trim();
  const readableCharactersValue = trimmedReadableValue.replace(/\s+/g, " ");

  return {
    characters: readableCharactersValue.length,
    lines: value ? value.split("\n").length : 1,
    words: trimmedReadableValue ? trimmedReadableValue.split(/\s+/).length : 0,
  };
}

function MarkdownPreview({
  onTaskCheckedChange,
  value,
}: {
  onTaskCheckedChange?: (taskIndex: number, checked: boolean) => void;
  value: string;
}) {
  return value.trim() ? (
    <TaskMarkup
      className="min-w-0"
      markup={{
        content: value,
        format: "markdown",
      }}
      onTaskCheckedChange={onTaskCheckedChange}
    />
  ) : (
    <Empty className="h-full min-h-full rounded-none border-0 bg-muted/20">
      <EmptyHeader>
        <EmptyTitle>Nothing to preview.</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function editorEditableExtensions(disabled: boolean, ariaLabel: string) {
  return [
    EditorState.readOnly.of(disabled),
    EditorView.editable.of(!disabled),
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      "aria-multiline": "true",
      "aria-readonly": disabled ? "true" : "false",
      autocapitalize: "sentences",
      autocorrect: "on",
      role: "textbox",
      spellcheck: "true",
    }),
  ];
}

function editorWrapExtensions(wrapLines: boolean) {
  return wrapLines ? [EditorView.lineWrapping] : [];
}

function createMarkdownEditorState({
  disabled,
  editorAriaLabel,
  editableCompartment,
  onUpdate,
  placeholderCompartment,
  placeholderText,
  selection,
  value,
  wrapCompartment,
  wrapLines,
}: {
  disabled: boolean;
  editorAriaLabel: string;
  editableCompartment: Compartment;
  onUpdate: (update: ViewUpdate) => void;
  placeholderCompartment: Compartment;
  placeholderText: string;
  selection?: EditorSelection;
  value: string;
  wrapCompartment: Compartment;
  wrapLines: boolean;
}) {
  return EditorState.create({
    doc: value,
    extensions: [
      ...markdownEditorBaseExtensions,
      editableCompartment.of(editorEditableExtensions(disabled, editorAriaLabel)),
      wrapCompartment.of(editorWrapExtensions(wrapLines)),
      placeholderCompartment.of(placeholder(placeholderText)),
      EditorView.updateListener.of(onUpdate),
    ],
    selection: selection ?? EditorSelection.create([EditorSelection.cursor(0)]),
  });
}

function clampEditorSelection(selection: EditorSelection, docLength: number) {
  const ranges = selection.ranges.map((range) => {
    const anchor = Math.min(range.anchor, docLength);
    const head = Math.min(range.head, docLength);

    return anchor === head
      ? EditorSelection.cursor(head)
      : EditorSelection.range(anchor, head);
  });

  return EditorSelection.create(
    ranges,
    Math.min(selection.mainIndex, ranges.length - 1),
  );
}

function syncScrollPosition(source: HTMLElement, target: HTMLElement) {
  const sourceMaxScroll = source.scrollHeight - source.clientHeight;
  const targetMaxScroll = target.scrollHeight - target.clientHeight;

  if (targetMaxScroll <= 0) {
    target.scrollTop = 0;
    return;
  }

  if (sourceMaxScroll <= 0) {
    target.scrollTop = 0;
    return;
  }

  const nextScrollTop = Math.round(
    (source.scrollTop / sourceMaxScroll) * targetMaxScroll,
  );

  if (Math.abs(target.scrollTop - nextScrollTop) > 1) {
    target.scrollTop = nextScrollTop;
  }
}

function isMarkdownEditorMode(value: unknown): value is MarkdownEditorMode {
  return value === "editor" || value === "split" || value === "preview";
}

function parseMarkdownEditorPreferences(storedValue: string | null) {
  try {
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as {
      mode?: unknown;
      wrapLines?: unknown;
    };

    return {
      mode: isMarkdownEditorMode(parsedValue.mode) ? parsedValue.mode : "split",
      wrapLines: typeof parsedValue.wrapLines === "boolean"
        ? parsedValue.wrapLines
        : true,
    } satisfies MarkdownEditorPreferences;
  } catch {
    return null;
  }
}

function writeMarkdownEditorPreferences(preferences: MarkdownEditorPreferences) {
  try {
    window.localStorage.setItem(
      markdownEditorPreferencesKey,
      JSON.stringify(preferences),
    );
  } catch {
    // Preference persistence should never block editing.
  }
}

function shouldUseCompactFocusedEditorMode() {
  return window.innerWidth < compactMarkdownEditorViewportWidth;
}

function initialMarkdownEditorDisplayMode(
  preferredMode: MarkdownEditorMode,
  autoFocus: boolean,
) {
  if (!autoFocus) {
    return preferredMode;
  }

  if (shouldUseCompactFocusedEditorMode()) {
    return "editor";
  }

  return preferredMode === "preview" ? "split" : preferredMode;
}

function isMarkdownEditorSplitLayout(
  value: unknown,
): value is MarkdownEditorSplitLayout {
  if (!value || typeof value !== "object") {
    return false;
  }

  const layout = value as Record<string, unknown>;

  return typeof layout.editor === "number" &&
    Number.isFinite(layout.editor) &&
    typeof layout.preview === "number" &&
    Number.isFinite(layout.preview);
}

function normalizeMarkdownEditorSplitLayout(
  value: unknown,
): MarkdownEditorSplitLayout | null {
  if (!isMarkdownEditorSplitLayout(value)) {
    return null;
  }

  const total = value.editor + value.preview;

  if (total <= 0) {
    return null;
  }

  const editorSize = Math.min(
    100 - minimumMarkdownEditorSplitPaneSize,
    Math.max(
      minimumMarkdownEditorSplitPaneSize,
      (value.editor / total) * 100,
    ),
  );

  return {
    editor: editorSize,
    preview: 100 - editorSize,
  };
}

function parseMarkdownEditorSplitLayout(storedValue: string | null) {
  try {
    if (!storedValue) {
      return null;
    }

    const parsedValue = JSON.parse(storedValue) as unknown;

    return normalizeMarkdownEditorSplitLayout(parsedValue);
  } catch {
    return null;
  }
}

const serverMarkdownEditorStorageSnapshot = "server";

function getMarkdownEditorStorageSnapshot() {
  try {
    return JSON.stringify([
      window.localStorage.getItem(markdownEditorPreferencesKey),
      window.localStorage.getItem(markdownEditorSplitLayoutKey),
    ]);
  } catch {
    return JSON.stringify([null, null]);
  }
}

function subscribeToMarkdownEditorStorage(onStoreChange: () => void) {
  const handleStorageChange = (event: StorageEvent) => {
    if (
      event.key === markdownEditorPreferencesKey ||
      event.key === markdownEditorSplitLayoutKey
    ) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

function parseMarkdownEditorStorageSnapshot(snapshot: string) {
  if (snapshot === serverMarkdownEditorStorageSnapshot) {
    return {
      preferences: null,
      preferencesLoaded: false,
      splitLayout: null,
    };
  }

  try {
    const [preferencesValue, splitLayoutValue] = JSON.parse(snapshot) as [
      string | null,
      string | null,
    ];

    return {
      preferences: parseMarkdownEditorPreferences(preferencesValue),
      preferencesLoaded: true,
      splitLayout: parseMarkdownEditorSplitLayout(splitLayoutValue),
    };
  } catch {
    return {
      preferences: null,
      preferencesLoaded: true,
      splitLayout: null,
    };
  }
}

function writeMarkdownEditorSplitLayout(layout: Record<string, number>) {
  const normalizedLayout = normalizeMarkdownEditorSplitLayout(layout);

  if (!normalizedLayout) {
    return;
  }

  try {
    window.localStorage.setItem(
      markdownEditorSplitLayoutKey,
      JSON.stringify(normalizedLayout),
    );
  } catch {
    // Preference persistence should never block editing.
  }
}

function indentationWidth(value: string) {
  return Array.from(value).reduce(
    (width, character) => width + (character === "\t" ? 4 : 1),
    0,
  );
}

function blockquoteDepth(value: string) {
  return value.split("").filter((character) => character === ">").length;
}

function markdownListItemContext(line: string) {
  const match = line.match(markdownListItemIndentPattern);

  return match
    ? {
        indent: indentationWidth(match[2] ?? ""),
        quoteDepth: blockquoteDepth(match[1] ?? ""),
      }
    : null;
}

function markdownIndentedLineContext(line: string) {
  const match = line.match(markdownIndentedLinePattern);

  return match
    ? {
        indent: indentationWidth(match[2] ?? ""),
        quoteDepth: blockquoteDepth(match[1] ?? ""),
      }
    : null;
}

function hasListAncestor(
  listItemIndentsByQuoteDepth: Map<number, number[]>,
  quoteDepth: number,
  indent: number,
) {
  return (listItemIndentsByQuoteDepth.get(quoteDepth) ?? [])
    .some((listIndent) => listIndent < indent);
}

function findTaskListItemChange(
  value: string,
  taskIndex: number,
  checked: boolean,
) {
  const lines = value.split("\n");
  let currentTaskIndex = 0;
  let fencedCode:
    | {
        marker: "`" | "~";
        size: number;
      }
    | null = null;
  let lineStart = 0;
  const listItemIndentsByQuoteDepth = new Map<number, number[]>();

  for (const line of lines) {
    const fenceMatch = line.match(fencedCodeBoundaryPattern);

    if (fencedCode) {
      const fence = fenceMatch?.[1] ?? "";
      const remainder = fenceMatch?.[2] ?? "";

      if (
        fence[0] === fencedCode.marker &&
        fence.length >= fencedCode.size &&
        /^\s*$/.test(remainder)
      ) {
        fencedCode = null;
      }

      lineStart += line.length + 1;
      continue;
    }

    if (fenceMatch) {
      const fence = fenceMatch[1] ?? "";
      const marker = fence[0] as "`" | "~";
      const remainder = fenceMatch[2] ?? "";

      if (marker !== "`" || !remainder.includes("`")) {
        fencedCode = {
          marker,
          size: fence.length,
        };
        lineStart += line.length + 1;
        continue;
      }
    }

    const listItemContext = markdownListItemContext(line);
    const lineContext = listItemContext ?? markdownIndentedLineContext(line);
    const isNestedListItem = listItemContext !== null &&
      hasListAncestor(
        listItemIndentsByQuoteDepth,
        listItemContext.quoteDepth,
        listItemContext.indent,
      );

    if (indentedCodeTaskListItemPattern.test(line) && !isNestedListItem) {
      lineStart += line.length + 1;
      continue;
    }

    if (line.trim()) {
      if (listItemContext === null) {
        if (
          !lineContext ||
          !hasListAncestor(
            listItemIndentsByQuoteDepth,
            lineContext.quoteDepth,
            lineContext.indent,
          )
        ) {
          listItemIndentsByQuoteDepth.clear();
        }
      } else {
        const listItemIndents =
          listItemIndentsByQuoteDepth.get(listItemContext.quoteDepth) ?? [];

        listItemIndentsByQuoteDepth.set(
          listItemContext.quoteDepth,
          [
            ...listItemIndents.filter((indent) => indent < listItemContext.indent),
            listItemContext.indent,
          ],
        );
      }
    }

    if (!taskListItemPattern.test(line)) {
      lineStart += line.length + 1;
      continue;
    }

    if (currentTaskIndex !== taskIndex) {
      currentTaskIndex += 1;
      lineStart += line.length + 1;
      continue;
    }

    const nextLine = line.replace(
      taskListItemPattern,
      `$1${checked ? "x" : " "}$2`,
    );

    if (nextLine === line) {
      return null;
    }

    return {
      from: lineStart,
      insert: nextLine,
      to: lineStart + line.length,
    };
  }

  return null;
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const storageSnapshot = useSyncExternalStore(
    subscribeToMarkdownEditorStorage,
    getMarkdownEditorStorageSnapshot,
    () => serverMarkdownEditorStorageSnapshot,
  );
  const initialState = parseMarkdownEditorStorageSnapshot(storageSnapshot);

  return (
    <MarkdownEditorState
      key={storageSnapshot}
      {...props}
      initialPreferences={initialState.preferences}
      initialPreferencesLoaded={initialState.preferencesLoaded}
      initialSplitLayout={initialState.splitLayout}
    />
  );
}

function MarkdownEditorState({
  ariaLabel = "Markdown content",
  autoFocus = false,
  className,
  disabled = false,
  initialPreferences,
  initialPreferencesLoaded,
  initialSplitLayout,
  modeAriaLabel = "Markdown editor mode",
  onChange,
  placeholder: placeholderText = "Add markdown...",
  previewAriaLabel = "Markdown preview",
  statisticsAriaLabel = "Markdown statistics",
  toolbarAriaLabel = "Markdown formatting",
  value,
}: MarkdownEditorProps & {
  initialPreferences: MarkdownEditorPreferences | null;
  initialPreferencesLoaded: boolean;
  initialSplitLayout: MarkdownEditorSplitLayout | null;
}) {
  const preferredMode = initialPreferences?.mode ?? "split";
  const initialWrapLines = initialPreferences?.wrapLines ?? true;
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const initialAutoFocusRef = useRef(autoFocus);
  const initialAriaLabelRef = useRef(ariaLabel);
  const initialDisabledRef = useRef(disabled);
  const initialPlaceholderRef = useRef(placeholderText);
  const initialValueRef = useRef(value);
  const initialWrapLinesRef = useRef(initialWrapLines);
  const isSyncingScrollRef = useRef(false);
  const modePreferenceRef = useRef<MarkdownEditorMode>(preferredMode);
  const modeDescriptionId = useId();
  const onChangeRef = useRef(onChange);
  const shouldFocusEditorAfterModeChangeRef = useRef(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [editableCompartment] = useState(() => new Compartment());
  const [wrapCompartment] = useState(() => new Compartment());
  const [placeholderCompartment] = useState(() => new Compartment());
  const [mode, setMode] = useState<MarkdownEditorMode>(() =>
    initialMarkdownEditorDisplayMode(preferredMode, autoFocus)
  );
  const [activeToolbarCommands, setActiveToolbarCommands] = useState<
    ReadonlySet<MarkdownCommandName>
  >(() => new Set());
  const [historyDepths, setHistoryDepths] = useState<MarkdownEditorHistoryDepths>({
    redo: 0,
    undo: 0,
  });
  const [splitLayout, setSplitLayout] = useState<MarkdownEditorSplitLayout>(
    initialSplitLayout ?? defaultMarkdownEditorSplitLayout,
  );
  const [wrapLines, setWrapLines] = useState(initialWrapLines);
  const stats = useMemo(() => getMarkdownStats(value), [value]);
  const isCodeBlockActive = activeToolbarCommands.has("codeBlock");
  const showEditor = mode !== "preview";
  const showEditorDisplayControls = mode !== "preview";
  const showFormattingControls = mode !== "preview" && !disabled;
  const showPreview = mode !== "editor";

  const updateEditorStateIndicators = useCallback((state: EditorState) => {
    setActiveToolbarCommands(getActiveMarkdownCommands(state));
    setHistoryDepths({
      redo: redoDepth(state),
      undo: undoDepth(state),
    });
  }, []);

  const handleEditorUpdate = useCallback((update: ViewUpdate) => {
    if (update.docChanged || update.selectionSet) {
      updateEditorStateIndicators(update.state);
    }

    if (!update.docChanged) {
      return;
    }

    const nextValue = update.state.doc.toString();
    onChangeRef.current(nextValue);
  }, [updateEditorStateIndicators]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!initialPreferencesLoaded) {
      return;
    }

    writeMarkdownEditorPreferences({
      mode: modePreferenceRef.current,
      wrapLines,
    });
  }, [initialPreferencesLoaded, mode, wrapLines]);

  useEffect(() => {
    const view = editorViewRef.current;

    if (!view || view.state.doc.toString() === value) {
      return;
    }

    view.setState(createMarkdownEditorState({
      disabled,
      editorAriaLabel: ariaLabel,
      editableCompartment,
      onUpdate: handleEditorUpdate,
      placeholderCompartment,
      placeholderText,
      selection: clampEditorSelection(view.state.selection, value.length),
      value,
      wrapCompartment,
      wrapLines,
    }));
    updateEditorStateIndicators(view.state);
  }, [
    disabled,
    ariaLabel,
    editableCompartment,
    handleEditorUpdate,
    placeholderCompartment,
    placeholderText,
    updateEditorStateIndicators,
    value,
    wrapCompartment,
    wrapLines,
  ]);

  useEffect(() => {
    if (!editorContainerRef.current || editorViewRef.current) {
      return;
    }

    const view = new EditorView({
      parent: editorContainerRef.current,
      state: createMarkdownEditorState({
        disabled: initialDisabledRef.current,
        editorAriaLabel: initialAriaLabelRef.current,
        editableCompartment,
        onUpdate: handleEditorUpdate,
        placeholderCompartment,
        placeholderText: initialPlaceholderRef.current,
        selection: initialAutoFocusRef.current
          ? EditorSelection.create([
            EditorSelection.cursor(initialValueRef.current.length),
          ])
          : undefined,
        value: initialValueRef.current,
        wrapCompartment,
        wrapLines: initialWrapLinesRef.current,
      }),
    });

    editorViewRef.current = view;
    updateEditorStateIndicators(view.state);

    if (initialAutoFocusRef.current && !initialDisabledRef.current) {
      window.requestAnimationFrame(() => {
        view.focus();
      });
    }

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [
    editableCompartment,
    handleEditorUpdate,
    placeholderCompartment,
    updateEditorStateIndicators,
    wrapCompartment,
  ]);

  useLayoutEffect(() => {
    const editorContainer = editorContainerRef.current;
    const editorView = editorViewRef.current;

    if (!editorContainer || !editorView) {
      return;
    }

    if (editorView.dom.parentElement !== editorContainer) {
      editorContainer.appendChild(editorView.dom);
      editorView.requestMeasure();
    }

    if (shouldFocusEditorAfterModeChangeRef.current && mode !== "preview" && !disabled) {
      shouldFocusEditorAfterModeChangeRef.current = false;
      editorView.focus();
    }
  }, [disabled, mode]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: editableCompartment.reconfigure(
        editorEditableExtensions(disabled, ariaLabel),
      ),
    });
  }, [ariaLabel, disabled, editableCompartment]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: wrapCompartment.reconfigure(editorWrapExtensions(wrapLines)),
    });
  }, [wrapCompartment, wrapLines]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: placeholderCompartment.reconfigure(placeholder(placeholderText)),
    });
  }, [placeholderCompartment, placeholderText]);

  useEffect(() => {
    if (mode !== "split") {
      return;
    }

    const editorScroller = editorViewRef.current?.scrollDOM;
    const previewScroller = previewContainerRef.current;

    if (!editorScroller || !previewScroller) {
      return;
    }

    const editorScrollElement = editorScroller;
    const previewScrollElement = previewScroller;

    function syncFrom(source: HTMLElement, target: HTMLElement) {
      if (isSyncingScrollRef.current) {
        return;
      }

      isSyncingScrollRef.current = true;

      try {
        syncScrollPosition(source, target);
      } finally {
        isSyncingScrollRef.current = false;
      }
    }

    function handleEditorScroll() {
      syncFrom(editorScrollElement, previewScrollElement);
    }

    function handlePreviewScroll() {
      syncFrom(previewScrollElement, editorScrollElement);
    }

    editorScrollElement.addEventListener("scroll", handleEditorScroll, {
      passive: true,
    });
    previewScrollElement.addEventListener("scroll", handlePreviewScroll, {
      passive: true,
    });

    window.requestAnimationFrame(handleEditorScroll);

    return () => {
      editorScrollElement.removeEventListener("scroll", handleEditorScroll);
      previewScrollElement.removeEventListener("scroll", handlePreviewScroll);
    };
  }, [mode, value]);

  function runCommand(commandName: MarkdownCommandName) {
    const view = editorViewRef.current;

    if (!view || disabled || mode === "preview") {
      return;
    }

    runMarkdownCommand(view, commandName);
  }

  function runEditorCommand(command: typeof undo | typeof redo) {
    const view = editorViewRef.current;

    if (!view || disabled || mode === "preview") {
      return;
    }

    view.focus();
    command(view);
  }

  function toggleLineWrap() {
    if (!disabled) {
      editorViewRef.current?.focus();
    }

    setWrapLines((current) => !current);
  }

  function selectMode(nextMode: MarkdownEditorMode) {
    modePreferenceRef.current = nextMode;
    shouldFocusEditorAfterModeChangeRef.current = nextMode !== "preview" && !disabled;
    setMode(nextMode);
  }

  function toggleTaskListItem(taskIndex: number, checked: boolean) {
    const view = editorViewRef.current;
    const sourceValue = view?.state.doc.toString() ?? value;
    const change = findTaskListItemChange(sourceValue, taskIndex, checked);

    if (!change) {
      return;
    }

    if (view) {
      view.dispatch({
        changes: change,
        userEvent: "input",
      });
      return;
    }

    onChange(
      `${sourceValue.slice(0, change.from)}${change.insert}${sourceValue.slice(change.to)}`,
    );
  }

  return (
    <div
      className={cn(
        "w-full max-w-full min-w-0 overflow-hidden rounded-lg border bg-background shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b bg-muted/25 p-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        {showFormattingControls ? (
          <div
            aria-label={toolbarAriaLabel}
            className="flex min-w-0 max-w-full flex-wrap items-center gap-1"
            role="toolbar"
          >
            {toolbarGroups.map((group, groupIndex) => (
              <div
                key={group.label}
                aria-label={group.label}
                className="flex max-w-full flex-wrap items-center gap-1"
                role="group"
              >
                {groupIndex > 0 ? (
                  <Separator
                    aria-hidden="true"
                    orientation="vertical"
                    role="presentation"
                    className="mx-1 hidden h-6 sm:block"
                  />
                ) : null}
                {group.actions.map((action) => {
                  const Icon = action.icon;
                  const isActive = activeToolbarCommands.has(action.command);
                  const isDisabled =
                    disabled ||
                    (isCodeBlockActive && action.command !== "codeBlock");

                  return (
                    <Tooltip key={action.command}>
                      <TooltipTrigger
                        render={(
                          <Button
                            aria-label={action.label}
                            aria-pressed={action.isInsertAction
                              ? isActive || undefined
                              : isActive}
                            aria-keyshortcuts={action.shortcut === "link"
                              ? "Meta+K Control+K"
                              : undefined}
                            disabled={isDisabled}
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => runCommand(action.command)}
                            size="icon-sm"
                            type="button"
                            variant={isActive ? "secondary" : "ghost"}
                          />
                        )}
                      >
                        <Icon data-icon="inline-start" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span>{action.label}</span>
                        <ShortcutHint shortcut={action.shortcut} />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}

        <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5">
          {showFormattingControls ? (
            <>
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button
                      aria-label="Undo"
                      disabled={disabled || historyDepths.undo === 0}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => runEditorCommand(undo)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  )}
                >
                  <Undo2Icon data-icon="inline-start" />
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={(
                    <Button
                      aria-label="Redo"
                      disabled={disabled || historyDepths.redo === 0}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      onClick={() => runEditorCommand(redo)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  )}
                >
                  <Redo2Icon data-icon="inline-start" />
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>
            </>
          ) : null}
          {showEditorDisplayControls ? (
            <Tooltip>
              <TooltipTrigger
                render={(
                  <Button
                    aria-label={wrapLines ? "Disable line wrap" : "Enable line wrap"}
                    aria-pressed={wrapLines}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={toggleLineWrap}
                    size="icon-sm"
                    type="button"
                    variant={wrapLines ? "secondary" : "ghost"}
                  />
                )}
              >
                <WrapTextIcon data-icon="inline-start" />
              </TooltipTrigger>
              <TooltipContent>{wrapLines ? "Line wrap on" : "Line wrap off"}</TooltipContent>
            </Tooltip>
          ) : null}
          <div hidden>
            {markdownEditorModeOrder.map((modeValue) => (
              <span key={modeValue} id={`${modeDescriptionId}-${modeValue}`}>
                {markdownEditorModeConfig[modeValue].description}
              </span>
            ))}
          </div>
          <ToggleGroup
            aria-label={modeAriaLabel}
            onValueChange={(nextMode) => {
              const selectedMode = nextMode[0] as MarkdownEditorMode | undefined;

              if (selectedMode) {
                selectMode(selectedMode);
              }
            }}
            spacing={0}
            value={[mode]}
            variant="outline"
          >
            {markdownEditorModeOrder.map((modeValue) => {
              const { description, icon: Icon, label } =
                markdownEditorModeConfig[modeValue];

              return (
                <Tooltip key={modeValue}>
                  <TooltipTrigger
                    render={(
                      <ToggleGroupItem
                        aria-describedby={`${modeDescriptionId}-${modeValue}`}
                        value={modeValue}
                      />
                    )}
                  >
                    <Icon data-icon="inline-start" />
                    {label}
                  </TooltipTrigger>
                  <TooltipContent>{description}</TooltipContent>
                </Tooltip>
              );
            })}
          </ToggleGroup>
        </div>
      </div>

      <div
        data-testid="markdown-editor-layout"
        className={cn(
          "min-w-0 max-w-full",
          markdownEditorSurfaceClassName,
          mode !== "split" && "grid",
        )}
      >
        {mode === "split" ? (
          <ResizablePanelGroup
            className="h-full"
            defaultLayout={splitLayout}
            onLayoutChanged={(layout) => {
              const normalizedLayout = normalizeMarkdownEditorSplitLayout(layout);

              if (!normalizedLayout) {
                return;
              }

              setSplitLayout(normalizedLayout);
              writeMarkdownEditorSplitLayout(normalizedLayout);
            }}
            orientation="horizontal"
          >
            <ResizablePanel
              className="min-w-0 overflow-hidden"
              defaultSize={`${splitLayout.editor}%`}
              id="editor"
              minSize={`${minimumMarkdownEditorSplitPaneSize}%`}
            >
              <div
                ref={editorContainerRef}
                className={markdownEditorInputPaneClassName}
              />
            </ResizablePanel>
            <ResizableHandle
              aria-label="Resize editor and preview panes"
              className="after:w-3"
              withHandle
            />
            <ResizablePanel
              className="min-w-0"
              defaultSize={`${splitLayout.preview}%`}
              id="preview"
              minSize={`${minimumMarkdownEditorSplitPaneSize}%`}
            >
              <div
                ref={previewContainerRef}
                aria-label={previewAriaLabel}
                data-testid="markdown-preview-pane"
                role="region"
                className="h-full min-h-0 min-w-0 overflow-auto bg-muted/10 p-4"
              >
                <MarkdownPreview
                  onTaskCheckedChange={disabled
                    ? undefined
                    : toggleTaskListItem}
                  value={value}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <>
            <div
              hidden={!showEditor}
              className="h-full min-w-0 overflow-hidden"
            >
              <div
                ref={editorContainerRef}
                className={markdownEditorInputPaneClassName}
              />
            </div>

            {showPreview ? (
              <div
                ref={previewContainerRef}
                aria-label={previewAriaLabel}
                data-testid="markdown-preview-pane"
                role="region"
                className="h-full min-h-0 min-w-0 overflow-auto bg-muted/10 p-4"
              >
                <MarkdownPreview
                  onTaskCheckedChange={disabled
                    ? undefined
                    : toggleTaskListItem}
                  value={value}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex justify-end border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span
          aria-label={statisticsAriaLabel}
          role="group"
          className="min-w-0 truncate"
        >
          {stats.lines} {stats.lines === 1 ? "line" : "lines"} · {stats.words}{" "}
          {stats.words === 1 ? "word" : "words"} · {stats.characters}{" "}
          {stats.characters === 1 ? "character" : "characters"}
        </span>
      </div>
    </div>
  );
}
