import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import {
  EditorSelection,
  EditorState,
  type Extension,
  type SelectionRange,
  type StateCommand,
} from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap } from "@codemirror/view";
import {
  blockRemovalRange,
  findFencedCodeBlockAtRange,
  isHttpUrl,
  isRangeInFencedCodeBlock,
  linkLikeSyntaxAtRange,
  markdownLinkDestination,
  markdownCommands,
} from "./commands";
import { convertHtmlToEditableMarkdown } from "@/lib/tasks/task-detail-edit";

export const markdownEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "hsl(var(--foreground))",
    fontSize: "0.875rem",
    height: "100%",
    minHeight: "100%",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-content": {
    caretColor: "hsl(var(--foreground))",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    lineHeight: "1.65",
    minHeight: "100%",
    padding: "1rem",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    borderRightColor: "hsl(var(--border))",
    color: "hsl(var(--muted-foreground))",
  },
  ".cm-activeLine": {
    backgroundColor: "hsl(var(--muted) / 0.28)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "hsl(var(--muted) / 0.35)",
    color: "hsl(var(--foreground))",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.24)",
  },
  ".cm-scroller": {
    height: "100%",
    minHeight: "100%",
  },
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground))",
  },
});

function numberedMarker(value: string) {
  const marker = Number.parseInt(value, 10);

  return Number.isNaN(marker) ? 1 : marker;
}

function escapeLinkLabel(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function linkLabelFromSelection(value: string) {
  return escapeLinkLabel(value.replace(/\s+/g, " ").trim());
}

function structuralInlinePrefix(line: string) {
  return line.match(
    /^((?:\s*>\s?)*\s*(?:(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s*)?)?)/,
  )?.[1] ?? "";
}

function hasBlockHtml(value: string) {
  return /<(?:address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|ul)\b/i
    .test(value);
}

function markdownPasteInsertion(
  state: EditorState,
  range: SelectionRange,
  markdown: string,
  sourceHtml: string,
) {
  if (!hasBlockHtml(sourceHtml)) {
    return markdown;
  }

  const previousCharacter = range.from > 0
    ? state.sliceDoc(range.from - 1, range.from)
    : "";
  const nextCharacter = range.to < state.doc.length
    ? state.sliceDoc(range.to, range.to + 1)
    : "";
  const prefix = previousCharacter && previousCharacter !== "\n" &&
    !markdown.startsWith("\n")
    ? "\n\n"
    : "";
  const suffix = nextCharacter && nextCharacter !== "\n" &&
    !markdown.endsWith("\n")
    ? "\n\n"
    : "";

  return `${prefix}${markdown}${suffix}`;
}

function isInlineMarkdownPaste(value: string) {
  return !value.includes("\n") &&
    !/^(?:#{1,6}\s|(?:[-*+]|\d+\.)\s+|>\s?|`{3,}|~{3,}|\|.+\||-{3,}\s*$)/.test(
      value,
    );
}

function isPlainMarkdownBlockPaste(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .some((line) =>
      /^(?:\s*(?:#{1,6}\s|(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s*)?|>\s?|`{3,}|~{3,}|\|.+\||-{3,}\s*$))/.test(
        line,
      ),
    );
}

function rangeWithoutSelectedLinePrefix(state: EditorState, range: SelectionRange) {
  const selectedLine = state.doc.lineAt(range.from);
  const selectedLinePrefix = structuralInlinePrefix(selectedLine.text);
  const rawSelectionText = state.sliceDoc(range.from, range.to);
  const shouldPreserveLinePrefix =
    selectedLinePrefix &&
    range.from === selectedLine.from &&
    range.to <= selectedLine.to &&
    rawSelectionText.startsWith(selectedLinePrefix);

  return {
    range: shouldPreserveLinePrefix
      ? EditorSelection.range(range.from + selectedLinePrefix.length, range.to)
      : range,
    linePrefix: shouldPreserveLinePrefix ? selectedLinePrefix : "",
    removedLinePrefix: Boolean(shouldPreserveLinePrefix),
  };
}

function structuralPrefixForPastedLine(prefix: string, lineIndex: number) {
  const orderedMatch = prefix.match(/^(.*?)(\d+)(\.\s+(?:\[[ xX]\]\s*)?)$/);

  if (!orderedMatch) {
    return prefix;
  }

  return `${orderedMatch[1]}${numberedMarker(orderedMatch[2] ?? "") + lineIndex}${orderedMatch[3]}`;
}

function pastedTextWithLinePrefix(prefix: string, value: string) {
  let contentLineIndex = 0;

  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => {
      if (!line.trim()) {
        return line;
      }

      const linePrefix = contentLineIndex === 0
        ? ""
        : structuralPrefixForPastedLine(prefix, contentLineIndex);
      contentLineIndex += 1;

      return `${linePrefix}${line}`;
    })
    .join("\n");
}

export function pasteUrlOverSelectionAsMarkdownLink(
  view: Pick<EditorView, "dispatch" | "state">,
  pastedText: string,
) {
  const range = view.state.selection.main;

  if (
    view.state.readOnly ||
    isRangeInFencedCodeBlock(view.state, range) ||
    !isHttpUrl(pastedText)
  ) {
    return false;
  }

  const effectiveRangeResult = rangeWithoutSelectedLinePrefix(view.state, range);
  const effectiveRange = effectiveRangeResult.range;
  const replaceFrom = effectiveRange.from;
  const selectionText = view.state.sliceDoc(effectiveRange.from, effectiveRange.to);
  const existingLink = linkLikeSyntaxAtRange(view.state, effectiveRange);

  if (existingLink) {
    const destination = markdownLinkDestination(pastedText);

    view.dispatch(view.state.update({
      changes: {
        from: existingLink.urlFrom,
        insert: destination,
        to: existingLink.urlTo,
      },
      selection: EditorSelection.cursor(existingLink.urlFrom + destination.length),
    }, { scrollIntoView: true, userEvent: "input.paste" }));

    return true;
  }

  if (range.empty) {
    return false;
  }

  if (isHttpUrl(selectionText)) {
    view.dispatch(view.state.update({
      changes: {
        from: replaceFrom,
        insert: pastedText,
        to: range.to,
      },
      selection: EditorSelection.cursor(replaceFrom + pastedText.length),
    }, { scrollIntoView: true, userEvent: "input.paste" }));

    return true;
  }

  const label = linkLabelFromSelection(selectionText);

  if (!label) {
    return false;
  }

  const destination = markdownLinkDestination(pastedText);
  const insert = `[${label}](${destination})`;

  view.dispatch(view.state.update({
    changes: {
      from: replaceFrom,
      insert,
      to: range.to,
    },
    selection: EditorSelection.cursor(replaceFrom + insert.length),
  }, { scrollIntoView: true, userEvent: "input.paste" }));

  return true;
}

export function pasteHtmlAsMarkdown(
  view: Pick<EditorView, "dispatch" | "state">,
  pastedHtml: string,
) {
  const range = view.state.selection.main;
  const effectiveRangeResult = rangeWithoutSelectedLinePrefix(view.state, range);
  const effectiveRange = effectiveRangeResult.range;

  if (
    view.state.readOnly ||
    !pastedHtml.trim() ||
    isRangeInFencedCodeBlock(view.state, effectiveRange)
  ) {
    return false;
  }

  const markdown = convertHtmlToEditableMarkdown(pastedHtml);

  if (!markdown) {
    return false;
  }

  const shouldPreserveLinePrefix =
    effectiveRangeResult.removedLinePrefix && isInlineMarkdownPaste(markdown);
  const replacementRange = shouldPreserveLinePrefix ? effectiveRange : range;
  const insert = shouldPreserveLinePrefix
    ? markdown
    : markdownPasteInsertion(
        view.state,
        replacementRange,
        markdown,
        pastedHtml,
      );

  view.dispatch(view.state.update({
    changes: {
      from: replacementRange.from,
      insert,
      to: replacementRange.to,
    },
    selection: EditorSelection.cursor(replacementRange.from + insert.length),
  }, { scrollIntoView: true, userEvent: "input.paste" }));

  return true;
}

export function pasteTextPreservingLinePrefix(
  view: Pick<EditorView, "dispatch" | "state">,
  pastedText: string,
) {
  const range = view.state.selection.main;

  if (
    view.state.readOnly ||
    range.empty ||
    !pastedText.trim() ||
    isHttpUrl(pastedText) ||
    isRangeInFencedCodeBlock(view.state, range)
  ) {
    return false;
  }

  const effectiveRangeResult = rangeWithoutSelectedLinePrefix(view.state, range);

  if (!effectiveRangeResult.removedLinePrefix) {
    return false;
  }

  const effectiveRange = effectiveRangeResult.range;
  const normalizedPastedText = pastedText.replace(/\r\n?/g, "\n");
  const shouldReplaceWholeRange = isPlainMarkdownBlockPaste(normalizedPastedText);
  const replacementRange = shouldReplaceWholeRange ? range : effectiveRange;
  const insert = pastedTextWithLinePrefix(
    effectiveRangeResult.linePrefix,
    normalizedPastedText,
  );

  view.dispatch(view.state.update({
    changes: {
      from: replacementRange.from,
      insert: shouldReplaceWholeRange ? normalizedPastedText : insert,
      to: replacementRange.to,
    },
    selection: EditorSelection.cursor(
      replacementRange.from +
        (shouldReplaceWholeRange ? normalizedPastedText.length : insert.length),
    ),
  }, { scrollIntoView: true, userEvent: "input.paste" }));

  return true;
}

function selectedLineNumbers(state: EditorState) {
  const range = state.selection.main;
  const startLine = state.doc.lineAt(range.from);
  const endPosition = range.empty ? range.to : Math.max(range.from, range.to - 1);
  const endLine = state.doc.lineAt(endPosition);
  const lineNumbers = [];

  for (
    let lineNumber = startLine.number;
    lineNumber <= endLine.number;
    lineNumber += 1
  ) {
    lineNumbers.push(lineNumber);
  }

  return lineNumbers;
}

function markdownListMarkerMatch(line: string) {
  return line.match(
    /^((?:\s*>\s?)*\s*)(?:[-*+]|\d+\.)\s+(?:\[[ xX]\](?:\s+|$))?/,
  );
}

function orderedListMarkerMatch(line: string) {
  return line.match(
    /^((?:\s*>\s?)*\s*)(\d+)(\.\s+(?:\[[ xX]\](?:\s+|$))?)/,
  );
}

function splitQuoteAndListIndentation(indentation: string) {
  const quotePrefix = indentation.match(/^(?:\s*>\s?)*/)?.[0] ?? "";

  return {
    listIndentation: indentation.slice(quotePrefix.length),
    quotePrefix,
  };
}

function indentInsideQuotePrefix(indentation: string) {
  const { listIndentation, quotePrefix } = splitQuoteAndListIndentation(indentation);

  return `${quotePrefix}${listIndentation}  `;
}

function outdentInsideQuotePrefix(indentation: string) {
  const { listIndentation, quotePrefix } = splitQuoteAndListIndentation(indentation);
  const removeCount = Math.min(2, listIndentation.length);

  return {
    indentation: `${quotePrefix}${listIndentation.slice(removeCount)}`,
    removeCount,
    removeFrom: quotePrefix.length,
  };
}

function parentQuotePrefix(prefix: string) {
  const quoteMarkers = Array.from(prefix.matchAll(/\s*>\s?/g), (match) => match[0]);

  return quoteMarkers.slice(0, -1).join("");
}

function followingOrderedListRenumberingChanges(
  state: EditorState,
  fromLineNumber: number,
  indentation: string,
  startNumber: number,
) {
  const changes = [];
  let nextNumber = startNumber;

  for (
    let lineNumber = fromLineNumber;
    lineNumber <= state.doc.lines;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);
    const match = orderedListMarkerMatch(line.text);

    if (!match || match[1] !== indentation) {
      break;
    }

    const currentNumber = match[2] ?? "";

    changes.push({
      from: line.from + indentation.length,
      insert: String(nextNumber),
      to: line.from + indentation.length + currentNumber.length,
    });
    nextNumber += 1;
  }

  return changes;
}

function previousOrderedListNumber(
  state: EditorState,
  fromLineNumber: number,
  indentation: string,
) {
  for (
    let lineNumber = fromLineNumber;
    lineNumber >= 1;
    lineNumber -= 1
  ) {
    const line = state.doc.line(lineNumber);
    const match = orderedListMarkerMatch(line.text);

    if (!match || match[1] !== indentation) {
      break;
    }

    return numberedMarker(match[2] ?? "1");
  }

  return 0;
}

const indentMarkdownList: StateCommand = (target) => {
  const { state, dispatch } = target;

  if (state.readOnly) {
    return false;
  }

  if (isRangeInFencedCodeBlock(state, state.selection.main)) {
    return indentMore(target);
  }

  const lineNumbers = selectedLineNumbers(state);
  const lines = lineNumbers.map((lineNumber) => state.doc.line(lineNumber));
  const listLines = lines.filter((line) => line.text.trim());

  if (
    listLines.length === 0 ||
    !listLines.every((line) => markdownListMarkerMatch(line.text))
  ) {
    return indentMore(target);
  }

  const orderedListMatches = listLines.map((line) => ({
    line,
    match: orderedListMarkerMatch(line.text),
  }));
  const firstOrderedMatch = orderedListMatches[0]?.match;
  const orderedIndentation = firstOrderedMatch?.[1];
  const shouldRenumberOrderedList =
    orderedIndentation !== undefined &&
    orderedListMatches.every(({ match }) => match?.[1] === orderedIndentation);

  if (shouldRenumberOrderedList) {
    const nextIndentation = indentInsideQuotePrefix(orderedIndentation);
    const firstLineNumber = orderedListMatches[0]?.line.number ?? 1;
    const lastLineNumber =
      orderedListMatches[orderedListMatches.length - 1]?.line.number ?? firstLineNumber;
    let nextNumber =
      previousOrderedListNumber(state, firstLineNumber - 1, nextIndentation) + 1;

    dispatch(state.update({
      changes: [
        ...orderedListMatches.map(({ line, match }) => {
          const currentNumber = match?.[2] ?? "";
          const replacement = `${nextIndentation}${nextNumber}`;
          nextNumber += 1;

          return {
            from: line.from,
            insert: replacement,
            to: line.from + orderedIndentation.length + currentNumber.length,
          };
        }),
        ...followingOrderedListRenumberingChanges(
          state,
          lastLineNumber + 1,
          orderedIndentation,
          previousOrderedListNumber(state, firstLineNumber - 1, orderedIndentation) + 1,
        ),
      ],
    }, { scrollIntoView: true, userEvent: "input" }));

    return true;
  }

  dispatch(state.update({
    changes: listLines.map((line) => ({
      from: line.from +
        splitQuoteAndListIndentation(
          markdownListMarkerMatch(line.text)?.[1] ?? "",
        ).quotePrefix.length,
      insert: "  ",
    })),
  }, { scrollIntoView: true, userEvent: "input" }));

  return true;
};

const outdentMarkdownList: StateCommand = (target) => {
  const { state, dispatch } = target;

  if (state.readOnly) {
    return false;
  }

  if (isRangeInFencedCodeBlock(state, state.selection.main)) {
    return indentLess(target);
  }

  const lineNumbers = selectedLineNumbers(state);
  const lines = lineNumbers.map((lineNumber) => state.doc.line(lineNumber));
  const listLines = lines.filter((line) => line.text.trim());

  if (
    listLines.length === 0 ||
    !listLines.every((line) => markdownListMarkerMatch(line.text))
  ) {
    return indentLess(target);
  }

  const orderedListMatches = listLines.map((line) => ({
    line,
    match: orderedListMarkerMatch(line.text),
  }));
  const firstOrderedMatch = orderedListMatches[0]?.match;
  const orderedIndentation = firstOrderedMatch?.[1];
  const shouldRenumberOrderedList =
    orderedIndentation !== undefined &&
    orderedListMatches.every(({ match }) => match?.[1] === orderedIndentation);

  if (shouldRenumberOrderedList && orderedIndentation.length > 0) {
    const { indentation: nextIndentation, removeCount } =
      outdentInsideQuotePrefix(orderedIndentation);

    if (removeCount === 0) {
      return true;
    }

    const firstLineNumber = orderedListMatches[0]?.line.number ?? 1;
    const lastLineNumber =
      orderedListMatches[orderedListMatches.length - 1]?.line.number ?? firstLineNumber;
    let nextNumber =
      previousOrderedListNumber(state, firstLineNumber - 1, nextIndentation) + 1;

    dispatch(state.update({
      changes: [
        ...orderedListMatches.map(({ line, match }) => {
          const currentNumber = match?.[2] ?? "";
          const replacement = `${nextIndentation}${nextNumber}`;
          nextNumber += 1;

          return {
            from: line.from,
            insert: replacement,
            to: line.from + orderedIndentation.length + currentNumber.length,
          };
        }),
        ...followingOrderedListRenumberingChanges(
          state,
          lastLineNumber + 1,
          orderedIndentation,
          previousOrderedListNumber(state, firstLineNumber - 1, orderedIndentation) + 1,
        ),
        ...followingOrderedListRenumberingChanges(
          state,
          lastLineNumber + 1,
          nextIndentation,
          nextNumber,
        ),
      ],
    }, { scrollIntoView: true, userEvent: "input" }));

    return true;
  }

  const changes = listLines.flatMap((line) => {
    const indentation = markdownListMarkerMatch(line.text)?.[1] ?? "";
    const { removeCount, removeFrom } = outdentInsideQuotePrefix(indentation);

    return removeCount > 0
      ? [{
        from: line.from + removeFrom,
        to: line.from + removeFrom + removeCount,
      }]
      : [];
  });

  if (changes.length === 0) {
    return true;
  }

  dispatch(state.update({
    changes,
  }, { scrollIntoView: true, userEvent: "input" }));

  return true;
};

function emptyInlineWrapperAtCursor(
  line: {
    from: number;
    text: string;
  },
  cursorOffset: number,
) {
  const wrappers = ["**", "__", "~~", "*", "_"];

  for (const wrapper of wrappers) {
    const from = cursorOffset - wrapper.length;
    const to = cursorOffset + wrapper.length;

    if (
      from >= 0 &&
      to <= line.text.length &&
      line.text.slice(from, cursorOffset) === wrapper &&
      line.text.slice(cursorOffset, to) === wrapper
    ) {
      return {
        from: line.from + from,
        to: line.from + to,
      };
    }
  }

  const beforeBackticks = line.text.slice(0, cursorOffset).match(/`+$/)?.[0] ?? "";
  const afterBackticks = line.text.slice(cursorOffset).match(/^`+/)?.[0] ?? "";

  if (beforeBackticks && beforeBackticks === afterBackticks) {
    return {
      from: line.from + cursorOffset - beforeBackticks.length,
      to: line.from + cursorOffset + afterBackticks.length,
    };
  }

  return null;
}

function unescapeLinkLikeText(value: string) {
  return value
    .replace(/^<([\s\S]*)>$/, "$1")
    .replace(/\\([\\[\]<>])/g, "$1");
}

const insertMarkdownContinuation: StateCommand = ({ state, dispatch }) => {
  const range = state.selection.main;

  if (state.readOnly) {
    return false;
  }

  if (!range.empty) {
    return false;
  }

  if (isRangeInFencedCodeBlock(state, range)) {
    return false;
  }

  const line = state.doc.lineAt(range.head);
  const cursorOffset = range.head - line.from;
  const lineText = line.text;
  const taskMatch = lineText.match(
    /^((?:\s*>\s?)*\s*)(?:([-*+])|(\d+)\.)\s+\[[ xX]\](?:\s+(.*))?$/,
  );

  if (taskMatch) {
    const indentation = taskMatch[1] ?? "";
    const bullet = taskMatch[2];
    const number = taskMatch[3];
    const content = taskMatch[4] ?? "";
    const markerLength = lineText.length - content.length;

    if (cursorOffset < markerLength) {
      return false;
    }

    if (!content.trim() && cursorOffset >= markerLength) {
      const renumberingChanges = number
        ? followingOrderedListRenumberingChanges(
          state,
          line.number + 1,
          indentation,
          previousOrderedListNumber(state, line.number - 1, indentation) + 1,
        )
        : [];

      dispatch(state.update({
        changes: [
          {
            from: line.from,
            insert: indentation,
            to: line.to,
          },
          ...renumberingChanges,
        ],
        selection: EditorSelection.cursor(line.from + indentation.length),
      }, { scrollIntoView: true, userEvent: "input" }));
      return true;
    }

    const prefix = number
      ? `${indentation}${numberedMarker(number) + 1}. [ ] `
      : `${indentation}${bullet} [ ] `;
    const renumberingChanges = number
      ? followingOrderedListRenumberingChanges(
        state,
        line.number + 1,
        indentation,
        numberedMarker(number) + 2,
      )
      : [];

    dispatch(state.update({
      changes: [
        {
          from: range.head,
          insert: `\n${prefix}`,
        },
        ...renumberingChanges,
      ],
      selection: EditorSelection.cursor(range.head + prefix.length + 1),
    }, { scrollIntoView: true, userEvent: "input" }));
    return true;
  }

  const orderedListMatch = lineText.match(/^((?:\s*>\s?)*\s*)(\d+)\.\s+(.*)$/);

  if (orderedListMatch) {
    const indentation = orderedListMatch[1] ?? "";
    const number = orderedListMatch[2] ?? "1";
    const content = orderedListMatch[3] ?? "";
    const markerLength = lineText.length - content.length;

    if (cursorOffset < markerLength) {
      return false;
    }

    if (!content.trim() && cursorOffset >= markerLength) {
      dispatch(state.update({
        changes: [
          {
            from: line.from,
            insert: indentation,
            to: line.to,
          },
          ...followingOrderedListRenumberingChanges(
            state,
            line.number + 1,
            indentation,
            previousOrderedListNumber(state, line.number - 1, indentation) + 1,
          ),
        ],
        selection: EditorSelection.cursor(line.from + indentation.length),
      }, { scrollIntoView: true, userEvent: "input" }));
      return true;
    }

    const nextNumber = numberedMarker(number) + 1;
    const prefix = `${indentation}${nextNumber}. `;

    dispatch(state.update({
      changes: [
        {
          from: range.head,
          insert: `\n${prefix}`,
        },
        ...followingOrderedListRenumberingChanges(
          state,
          line.number + 1,
          indentation,
          nextNumber + 1,
        ),
      ],
      selection: EditorSelection.cursor(range.head + prefix.length + 1),
    }, { scrollIntoView: true, userEvent: "input" }));
    return true;
  }

  const bulletListMatch = lineText.match(/^((?:\s*>\s?)*\s*)([-*+])\s+(.*)$/);

  if (bulletListMatch) {
    const indentation = bulletListMatch[1] ?? "";
    const bullet = bulletListMatch[2] ?? "-";
    const content = bulletListMatch[3] ?? "";
    const markerLength = lineText.length - content.length;

    if (cursorOffset < markerLength) {
      return false;
    }

    if (!content.trim() && cursorOffset >= markerLength) {
      dispatch(state.update({
        changes: {
          from: line.from,
          insert: indentation,
          to: line.to,
        },
        selection: EditorSelection.cursor(line.from + indentation.length),
      }, { scrollIntoView: true, userEvent: "input" }));
      return true;
    }

    const prefix = `${indentation}${bullet} `;

    dispatch(state.update({
      changes: {
        from: range.head,
        insert: `\n${prefix}`,
      },
      selection: EditorSelection.cursor(range.head + prefix.length + 1),
    }, { scrollIntoView: true, userEvent: "input" }));
    return true;
  }

  const quoteMatch = lineText.match(/^((?:\s*>\s?)+)(.*)$/);

  if (quoteMatch) {
    const prefix = quoteMatch[1] ?? "> ";
    const content = quoteMatch[2] ?? "";

    if (cursorOffset < prefix.length) {
      return false;
    }

    if (!content.trim() && cursorOffset >= prefix.length) {
      const nextPrefix = parentQuotePrefix(prefix);

      dispatch(state.update({
        changes: {
          from: line.from,
          insert: nextPrefix,
          to: line.to,
        },
        selection: EditorSelection.cursor(line.from + nextPrefix.length),
      }, { scrollIntoView: true, userEvent: "input" }));
      return true;
    }

    dispatch(state.update({
      changes: {
        from: range.head,
        insert: `\n${prefix}`,
      },
      selection: EditorSelection.cursor(range.head + prefix.length + 1),
    }, { scrollIntoView: true, userEvent: "input" }));
    return true;
  }

  return false;
};

function deleteEmptyInlineWrapper(
  { state, dispatch }: Parameters<StateCommand>[0],
  userEvent: "delete.backward" | "delete.forward",
) {
  const range = state.selection.main;

  if (state.readOnly || !range.empty) {
    return false;
  }

  const line = state.doc.lineAt(range.head);
  const cursorOffset = range.head - line.from;
  const wrapperRange = emptyInlineWrapperAtCursor(line, cursorOffset);

  if (!wrapperRange) {
    return false;
  }

  const fencedCodeBlock = findFencedCodeBlockAtRange(state, range);

  if (
    fencedCodeBlock &&
    (fencedCodeBlock.from !== wrapperRange.from ||
      fencedCodeBlock.to !== wrapperRange.to)
  ) {
    return false;
  }

  dispatch(state.update({
    changes: wrapperRange,
    selection: EditorSelection.cursor(wrapperRange.from),
  }, { scrollIntoView: true, userEvent }));

  return true;
}

function deleteEmptyLinkLikePlaceholder(
  { state, dispatch }: Parameters<StateCommand>[0],
  userEvent: "delete.backward" | "delete.forward",
) {
  const range = state.selection.main;

  if (
    state.readOnly ||
    !range.empty ||
    isRangeInFencedCodeBlock(state, range)
  ) {
    return false;
  }

  const existingSyntax = linkLikeSyntaxAtRange(state, range);

  if (!existingSyntax) {
    return false;
  }

  const label = state.sliceDoc(existingSyntax.labelFrom, existingSyntax.labelTo);
  const url = state.sliceDoc(existingSyntax.urlFrom, existingSyntax.urlTo);
  const isEmptyLabel = existingSyntax.labelFrom === existingSyntax.labelTo &&
    range.head === existingSyntax.labelFrom;
  const isEmptyUrl = existingSyntax.urlFrom === existingSyntax.urlTo &&
    range.head === existingSyntax.urlFrom;

  if (!isEmptyLabel && !isEmptyUrl) {
    return false;
  }

  const insert = isEmptyLabel
    ? unescapeLinkLikeText(url)
    : unescapeLinkLikeText(label);

  dispatch(state.update({
    changes: {
      from: existingSyntax.from,
      insert,
      to: existingSyntax.to,
    },
    selection: EditorSelection.cursor(existingSyntax.from + insert.length),
  }, { scrollIntoView: true, userEvent }));

  return true;
}

function deleteEmptyFencedCodeBlock(
  { state, dispatch }: Parameters<StateCommand>[0],
  userEvent: "delete.backward" | "delete.forward",
) {
  const range = state.selection.main;

  if (state.readOnly || !range.empty) {
    return false;
  }

  const fencedCodeBlock = findFencedCodeBlockAtRange(state, range);
  const fencedCodeContent = fencedCodeBlock
    ? state.sliceDoc(fencedCodeBlock.contentFrom, fencedCodeBlock.contentTo)
    : "";
  const readableCodeContent = fencedCodeBlock?.quotePrefix
    ? fencedCodeContent
        .split("\n")
        .map((line) => line.startsWith(fencedCodeBlock.quotePrefix)
          ? line.slice(fencedCodeBlock.quotePrefix.length)
          : line)
        .join("\n")
    : fencedCodeContent;

  if (
    !fencedCodeBlock ||
    range.head < fencedCodeBlock.contentFrom ||
    range.head > fencedCodeBlock.contentTo ||
    readableCodeContent.trim()
  ) {
    return false;
  }

  const removalRange = blockRemovalRange(
    state.doc.toString(),
    fencedCodeBlock.from,
    fencedCodeBlock.to,
  );

  dispatch(state.update({
    changes: {
      from: removalRange.from,
      to: removalRange.to,
    },
    selection: EditorSelection.cursor(removalRange.from),
  }, { scrollIntoView: true, userEvent }));

  return true;
}

function deleteEmptyMarkdownMarker(
  { state, dispatch }: Parameters<StateCommand>[0],
  userEvent: "delete.backward" | "delete.forward",
) {
  const range = state.selection.main;

  if (state.readOnly) {
    return false;
  }

  if (!range.empty) {
    return false;
  }

  if (isRangeInFencedCodeBlock(state, range)) {
    return false;
  }

  const line = state.doc.lineAt(range.head);
  const lineText = line.text;
  const markerMatch = lineText.match(
    /^((?:\s*>\s?)*\s*)(?:(?:[-*+]|\d+\.)\s+\[[ xX]\]\s*|(?:[-*+]|\d+\.)\s*|#{1,6}\s*|>\s*)$/,
  );

  if (!markerMatch || range.head !== line.to) {
    return false;
  }

  const indentation = markerMatch[1] ?? "";
  const orderedMarkerMatch = lineText.match(
    /^((?:\s*>\s?)*\s*)\d+\.\s+(?:\[[ xX]\]\s*)?$/,
  );
  const renumberingChanges = orderedMarkerMatch
    ? followingOrderedListRenumberingChanges(
      state,
      line.number + 1,
      indentation,
      previousOrderedListNumber(state, line.number - 1, indentation) + 1,
    )
    : [];

  dispatch(state.update({
    changes: [
      {
        from: line.from,
        insert: indentation,
        to: line.to,
      },
      ...renumberingChanges,
    ],
    selection: EditorSelection.cursor(line.from + indentation.length),
  }, { scrollIntoView: true, userEvent }));

  return true;
}

const deleteMarkdownBackspace: StateCommand = (target) =>
  deleteEmptyFencedCodeBlock(target, "delete.backward") ||
  deleteEmptyLinkLikePlaceholder(target, "delete.backward") ||
  deleteEmptyInlineWrapper(target, "delete.backward") ||
  deleteEmptyMarkdownMarker(target, "delete.backward");

const deleteMarkdownForward: StateCommand = (target) =>
  deleteEmptyFencedCodeBlock(target, "delete.forward") ||
  deleteEmptyLinkLikePlaceholder(target, "delete.forward") ||
  deleteEmptyInlineWrapper(target, "delete.forward") ||
  deleteEmptyMarkdownMarker(target, "delete.forward");

const insertMarkdownLink: StateCommand = (target) => {
  if (isRangeInFencedCodeBlock(target.state, target.state.selection.main)) {
    return false;
  }

  return markdownCommands.link(target);
};

export const markdownEditorKeymap = [
  {
    key: "Enter",
    run: insertMarkdownContinuation,
  },
  {
    key: "Backspace",
    run: deleteMarkdownBackspace,
  },
  {
    key: "Delete",
    run: deleteMarkdownForward,
  },
  {
    key: "Mod-k",
    run: insertMarkdownLink,
  },
  {
    key: "Tab",
    run: indentMarkdownList,
  },
  {
    key: "Shift-Tab",
    run: outdentMarkdownList,
  },
];

export const markdownEditorBaseExtensions: Extension[] = [
  history(),
  indentOnInput(),
  bracketMatching(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  highlightActiveLine(),
  markdown({
    base: markdownLanguage,
  }),
  keymap.of([
    ...markdownEditorKeymap,
    ...historyKeymap,
    ...defaultKeymap,
  ]),
  EditorView.domEventHandlers({
    paste(event, view) {
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";
      const pastedHtml = event.clipboardData?.getData("text/html") ?? "";

      if (
        !pasteUrlOverSelectionAsMarkdownLink(view, pastedText) &&
        !pasteHtmlAsMarkdown(view, pastedHtml) &&
        !pasteTextPreservingLinePrefix(view, pastedText)
      ) {
        return false;
      }

      event.preventDefault();
      return true;
    },
  }),
  EditorState.tabSize.of(2),
  markdownEditorTheme,
];
