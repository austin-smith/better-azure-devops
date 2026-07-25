import {
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type SelectionRange,
  type StateCommand,
  type Transaction,
} from "@codemirror/state";

export type MarkdownCommandName =
  | "bold"
  | "italic"
  | "strikethrough"
  | "inlineCode"
  | "heading1"
  | "heading2"
  | "heading3"
  | "paragraph"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "taskList"
  | "link"
  | "image"
  | "codeBlock"
  | "table"
  | "horizontalRule";

type Replacement = {
  changes: ChangeSpec;
  range: SelectionRange;
};

export type LinkLikeSyntax = {
  from: number;
  labelFrom: number;
  labelTo: number;
  to: number;
  type: "image" | "link";
  urlFrom: number;
  urlTo: number;
};

type InlineWrapper = {
  delimiter?: "*" | "_";
  prefix: string;
  requireNonWordBoundary?: boolean;
  suffix?: string;
};

type FencedCodeBlock = {
  contentFrom: number;
  contentTo: number;
  from: number;
  quotePrefix: string;
  to: number;
};

type MarkdownTable = {
  from: number;
  to: number;
};

const fencedCodeLinePattern = /^((?:\s*>\s?)*)\s{0,3}(`{3,}|~{3,})(.*)$/;

export function isHttpUrl(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue === value && /^https?:\/\/\S+$/i.test(trimmedValue);
}

export function markdownLinkDestination(value: string) {
  const shouldWrap = /[()<>]/.test(value);

  if (!shouldWrap) {
    return value;
  }

  return `<${value.replace(/[<>]/g, (character) => `\\${character}`)}>`;
}

function selectedText(state: EditorState, range: SelectionRange) {
  return state.sliceDoc(range.from, range.to);
}

function lineRangeForSelection(state: EditorState, range: SelectionRange) {
  const startLine = state.doc.lineAt(range.from);
  const endPosition = range.empty ? range.to : Math.max(range.from, range.to - 1);
  const endLine = state.doc.lineAt(endPosition);

  return {
    from: startLine.from,
    to: endLine.to,
  };
}

function lineRangeText(state: EditorState, range: SelectionRange) {
  const lineRange = lineRangeForSelection(state, range);

  return {
    ...lineRange,
    text: state.sliceDoc(lineRange.from, lineRange.to),
  };
}

function blockPrefix(line: string) {
  return line.match(/^((?:\s*>\s?)*\s*)/)?.[1] ?? "";
}

function structuralInlinePrefix(line: string) {
  return line.match(
    /^((?:\s*>\s?)*\s*(?:(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s*)?)?)/,
  )?.[1] ?? "";
}

function stripListMarker(line: string) {
  return line
    .replace(/^((?:\s*>\s?)*\s*)(?:[-*+]|\d+\.)\s+\[[ xX]\](?:\s+|$)/, "$1")
    .replace(/^((?:\s*>\s?)*\s*)[-*+]\s+/, "$1")
    .replace(/^((?:\s*>\s?)*\s*)\d+\.\s+/, "$1");
}

function hasTaskListMarker(line: string) {
  return /^((?:\s*>\s?)*\s*)(?:[-*+]|\d+\.)\s+\[[ xX]\](?:\s+|$)/.test(line);
}

function hasOrderedListMarker(line: string) {
  return /^((?:\s*>\s?)*\s*)\d+\.\s+/.test(line) && !hasTaskListMarker(line);
}

function hasUnorderedListMarker(line: string) {
  return /^((?:\s*>\s?)*\s*)[-*+]\s+/.test(line) && !hasTaskListMarker(line);
}

function stripHeadingMarker(line: string) {
  return line.replace(/^((?:\s*>\s?)*\s*)#{1,6}\s+/, "$1");
}

function hasHeadingMarker(line: string, level: 1 | 2 | 3) {
  return new RegExp(`^((?:\\s*>\\s?)*\\s*)#{${level}}\\s+`).test(line);
}

function stripQuoteMarker(line: string) {
  return line.replace(/^(\s*)>\s?/, "$1");
}

function hasQuoteMarker(line: string) {
  return /^(\s*)>\s?/.test(line);
}

function stripBlockMarker(line: string) {
  const indentation = blockPrefix(line);
  const content = line
    .slice(indentation.length)
    .replace(/^#{1,6}\s+/, "")
    .replace(/^(?:[-*+]|\d+\.)\s+\[[ xX]\](?:\s+|$)/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+\.\s+/, "");

  return `${indentation}${content}`;
}

function transformSelectedLines(
  state: EditorState,
  range: SelectionRange,
  transform: (line: string, index: number) => string,
  options: {
    selectText?: string;
  } = {},
): Replacement {
  const lineRange = lineRangeText(state, range);
  const nextText = lineRange.text.split("\n").map(transform).join("\n");
  const selectedTextStart = options.selectText
    ? nextText.indexOf(options.selectText)
    : -1;
  const selectionStart = selectedTextStart >= 0
    ? lineRange.from + selectedTextStart
    : lineRange.from;
  const selectionEnd = selectedTextStart >= 0 && options.selectText
    ? selectionStart + options.selectText.length
    : lineRange.from + nextText.length;

  return {
    changes: {
      from: lineRange.from,
      insert: nextText,
      to: lineRange.to,
    },
    range: EditorSelection.range(selectionStart, selectionEnd),
  };
}

function selectedNonEmptyLines(state: EditorState, range: SelectionRange) {
  return lineRangeText(state, range)
    .text
    .split("\n")
    .filter((line) => line.trim());
}

function commandFromReplacement(
  getReplacement: (state: EditorState, range: SelectionRange) => Replacement,
): StateCommand {
  return ({ state, dispatch }) => {
    if (state.readOnly) {
      return false;
    }

    const spec = state.changeByRange((range) => getReplacement(state, range));
    dispatch(state.update(spec, { scrollIntoView: true, userEvent: "input" }));

    return true;
  };
}

function isWordCharacter(value: string) {
  return /[0-9A-Za-z]/.test(value);
}

function createInlineWrapper(prefix: string, suffix = prefix): InlineWrapper {
  const delimiter = prefix === suffix && /^([*_])\1*$/.test(prefix)
    ? prefix[0] as "*" | "_"
    : undefined;

  return {
    delimiter,
    prefix,
    requireNonWordBoundary: delimiter === "_",
    suffix,
  };
}

function wrapperSuffix(wrapper: InlineWrapper) {
  return wrapper.suffix ?? wrapper.prefix;
}

function hasValidDelimiterBoundary(
  value: string,
  beforePrefix: number,
  afterPrefix: number,
  beforeSuffix: number,
  afterSuffix: number,
  wrapper: InlineWrapper,
) {
  const delimiter = wrapper.delimiter;
  const prefixFrom = beforePrefix + 1;
  const suffixFrom = beforeSuffix + 1;

  if (isEscaped(value, prefixFrom) || isEscaped(value, suffixFrom)) {
    return false;
  }

  if (delimiter) {
    if (
      value[beforePrefix] === delimiter ||
      value[afterPrefix] === delimiter ||
      value[beforeSuffix] === delimiter ||
      value[afterSuffix] === delimiter
    ) {
      return false;
    }
  }

  if (wrapper.requireNonWordBoundary) {
    if (
      isWordCharacter(value[beforePrefix] ?? "") ||
      isWordCharacter(value[afterSuffix] ?? "")
    ) {
      return false;
    }
  }

  return true;
}

function selectedTextHasWrapper(
  state: EditorState,
  range: SelectionRange,
  wrapper: InlineWrapper,
) {
  const currentText = selectedText(state, range);
  const suffix = wrapperSuffix(wrapper);

  if (
    !currentText.startsWith(wrapper.prefix) ||
    !currentText.endsWith(suffix) ||
    currentText.length <= wrapper.prefix.length + suffix.length
  ) {
    return false;
  }

  const beforePrefix = range.from - 1;
  const afterPrefix = range.from + wrapper.prefix.length;
  const beforeSuffix = range.to - suffix.length - 1;
  const afterSuffix = range.to;

  return hasValidDelimiterBoundary(
    state.doc.toString(),
    beforePrefix,
    afterPrefix,
    beforeSuffix,
    afterSuffix,
    wrapper,
  );
}

function findSurroundingWrapper(
  state: EditorState,
  range: SelectionRange,
  wrapper: InlineWrapper,
) {
  const suffix = wrapperSuffix(wrapper);
  const prefixFrom = range.from - wrapper.prefix.length;
  const suffixTo = range.to + suffix.length;

  if (
    prefixFrom < 0 ||
    suffixTo > state.doc.length ||
    state.sliceDoc(prefixFrom, range.from) !== wrapper.prefix ||
    state.sliceDoc(range.to, suffixTo) !== suffix
  ) {
    return null;
  }

  const beforePrefix = prefixFrom - 1;
  const afterPrefix = range.from;
  const beforeSuffix = range.to - 1;
  const afterSuffix = suffixTo;

  if (
    !hasValidDelimiterBoundary(
      state.doc.toString(),
      beforePrefix,
      afterPrefix,
      beforeSuffix,
      afterSuffix,
      wrapper,
    )
  ) {
    return null;
  }

  return {
    prefixFrom,
    suffixTo,
  };
}

function lineWrapper(content: string, wrappers: InlineWrapper[]) {
  return wrappers.find((wrapper) => {
    const suffix = wrapperSuffix(wrapper);

    return (
      content.startsWith(wrapper.prefix) &&
      content.endsWith(suffix) &&
      content.length > wrapper.prefix.length + suffix.length
    );
  }) ?? null;
}

function lineWisePrefixedWrapperReplacement(
  state: EditorState,
  range: SelectionRange,
  wrappers: InlineWrapper[],
  wrapperForContent: (content: string) => {
    prefix: string;
    suffix: string;
  },
): Replacement | null {
  const lineRange = lineRangeText(state, range);
  const lines = lineRange.text.split("\n");

  if (lines.length < 2) {
    return null;
  }

  const contentLines = lines
    .map((line) => ({
      content: line.slice(structuralInlinePrefix(line).length),
      line,
      prefix: structuralInlinePrefix(line),
    }))
    .filter(({ content }) => content.trim());

  if (
    contentLines.length === 0 ||
    !contentLines.every(({ prefix: linePrefix }) => linePrefix)
  ) {
    return null;
  }

  const shouldRemoveWrapper = contentLines.every(({ content }) =>
    lineWrapper(content, wrappers) !== null,
  );
  const nextText = lines.map((line) => {
    const lineStructuralPrefix = structuralInlinePrefix(line);
    const content = line.slice(lineStructuralPrefix.length);

    if (!content.trim() || !lineStructuralPrefix) {
      return line;
    }

    if (shouldRemoveWrapper) {
      const wrapper = lineWrapper(content, wrappers);
      const wrapperSuffixValue = wrapper ? wrapperSuffix(wrapper) : "";

      return wrapper
        ? `${lineStructuralPrefix}${content.slice(
          wrapper.prefix.length,
          content.length - wrapperSuffixValue.length,
        )}`
        : line;
    }

    const wrapper = wrapperForContent(content);

    return `${lineStructuralPrefix}${wrapper.prefix}${content}${wrapper.suffix}`;
  }).join("\n");

  return {
    changes: {
      from: lineRange.from,
      insert: nextText,
      to: lineRange.to,
    },
    range: EditorSelection.range(lineRange.from, lineRange.from + nextText.length),
  };
}

function wrapSelection(
  prefix: string,
  suffix: string,
  fallback: string,
  alternativeWrappers: InlineWrapper[] = [],
): StateCommand {
  const wrappers = [
    createInlineWrapper(prefix, suffix),
    ...alternativeWrappers,
  ];

  return commandFromReplacement((state, range) => {
    const {
      currentText,
      range: effectiveRange,
    } = rangeWithoutSelectedLinePrefix(state, range);
    const lineWiseReplacement = lineWisePrefixedWrapperReplacement(
      state,
      range,
      wrappers,
      () => ({
        prefix,
        suffix,
      }),
    );

    if (lineWiseReplacement) {
      return lineWiseReplacement;
    }

    for (const wrapper of wrappers) {
      const currentSuffix = wrapperSuffix(wrapper);

      if (!selectedTextHasWrapper(state, effectiveRange, wrapper)) {
        continue;
      }

      const content = currentText.slice(
        wrapper.prefix.length,
        currentText.length - currentSuffix.length,
      );

      return {
        changes: {
          from: effectiveRange.from,
          insert: content,
          to: effectiveRange.to,
        },
        range: EditorSelection.range(
          effectiveRange.from,
          effectiveRange.from + content.length,
        ),
      };
    }

    for (const wrapper of wrappers) {
      const surroundingWrapper = findSurroundingWrapper(state, effectiveRange, wrapper);

      if (!currentText || !surroundingWrapper) {
        continue;
      }

      return {
        changes: [
          {
            from: effectiveRange.to,
            to: surroundingWrapper.suffixTo,
          },
          {
            from: surroundingWrapper.prefixFrom,
            to: effectiveRange.from,
          },
        ],
        range: EditorSelection.range(
          effectiveRange.from - wrapper.prefix.length,
          effectiveRange.to - wrapper.prefix.length,
        ),
      };
    }

    const content = currentText || fallback;
    const insert = `${prefix}${content}${suffix}`;
    const selectionStart = effectiveRange.from + prefix.length;

    return {
      changes: {
        from: effectiveRange.from,
        insert,
        to: effectiveRange.to,
      },
      range: EditorSelection.range(selectionStart, selectionStart + content.length),
    };
  });
}

function createBacktickWrapper(size: number) {
  return createInlineWrapper("`".repeat(size));
}

function backtickRunLengths(value: string) {
  return Array.from(value.matchAll(/`+/g), (match) => match[0].length);
}

function inlineCodeWrappers(state: EditorState, range: SelectionRange) {
  const line = state.doc.lineAt(range.head);
  const sizes = new Set([
    1,
    ...backtickRunLengths(selectedText(state, range)),
    ...backtickRunLengths(line.text),
  ]);

  return Array.from(sizes)
    .sort((left, right) => right - left)
    .map(createBacktickWrapper);
}

function inlineCodeCommand(): StateCommand {
  return commandFromReplacement((state, range) => {
    const {
      currentText,
      range: effectiveRange,
    } = rangeWithoutSelectedLinePrefix(state, range);
    const lineWiseReplacement = lineWisePrefixedWrapperReplacement(
      state,
      range,
      inlineCodeWrappers(state, range),
      (content) => {
        const longestBacktickRun = Math.max(
          0,
          ...backtickRunLengths(content),
        );
        const delimiter = "`".repeat(longestBacktickRun + 1);

        return {
          prefix: delimiter,
          suffix: delimiter,
        };
      },
    );

    if (lineWiseReplacement) {
      return lineWiseReplacement;
    }

    for (const wrapper of inlineCodeWrappers(state, effectiveRange)) {
      const currentSuffix = wrapperSuffix(wrapper);

      if (!selectedTextHasWrapper(state, effectiveRange, wrapper)) {
        continue;
      }

      const content = currentText.slice(
        wrapper.prefix.length,
        currentText.length - currentSuffix.length,
      );

      return {
        changes: {
          from: effectiveRange.from,
          insert: content,
          to: effectiveRange.to,
        },
        range: EditorSelection.range(
          effectiveRange.from,
          effectiveRange.from + content.length,
        ),
      };
    }

    for (const wrapper of inlineCodeWrappers(state, effectiveRange)) {
      const surroundingWrapper = findSurroundingWrapper(state, effectiveRange, wrapper);

      if (!currentText || !surroundingWrapper) {
        continue;
      }

      return {
        changes: [
          {
            from: effectiveRange.to,
            to: surroundingWrapper.suffixTo,
          },
          {
            from: surroundingWrapper.prefixFrom,
            to: effectiveRange.from,
          },
        ],
        range: EditorSelection.range(
          effectiveRange.from - wrapper.prefix.length,
          effectiveRange.to - wrapper.prefix.length,
        ),
      };
    }

    const content = currentText || "code";
    const longestBacktickRun = Math.max(
      0,
      ...backtickRunLengths(content),
    );
    const delimiter = "`".repeat(longestBacktickRun + 1);
    const insert = `${delimiter}${content}${delimiter}`;
    const selectionStart = effectiveRange.from + delimiter.length;

    return {
      changes: {
        from: effectiveRange.from,
        insert,
        to: effectiveRange.to,
      },
      range: EditorSelection.range(selectionStart, selectionStart + content.length),
    };
  });
}

function setHeading(level: 0 | 1 | 2 | 3): StateCommand {
  return commandFromReplacement((state, range) => {
    const lines = selectedNonEmptyLines(state, range);
    const hasSelectedContent = lines.length > 0;
    const shouldRemoveHeading =
      level === 0 ||
      (hasSelectedContent &&
        lines.every((line) => hasHeadingMarker(line, level as 1 | 2 | 3)));

    return transformSelectedLines(
      state,
      range,
      (line) => {
        if (hasSelectedContent && !line.trim()) {
          return line;
        }

        const indentation = blockPrefix(line);
        const content = stripBlockMarker(stripHeadingMarker(line))
          .slice(indentation.length)
          .trimStart();

        if (shouldRemoveHeading) {
          return `${indentation}${content}`;
        }

        return `${indentation}${"#".repeat(level)} ${content || "Heading"}`;
      },
      {
        selectText: !hasSelectedContent && !shouldRemoveHeading
          ? "Heading"
          : undefined,
      },
    );
  });
}

function listCommand(
  markerForLine: (index: number) => string,
  fallback: string,
  isCurrentMarker: (line: string) => boolean,
): StateCommand {
  return commandFromReplacement((state, range) => {
    const lines = selectedNonEmptyLines(state, range);
    const hasSelectedContent = lines.length > 0;
    const shouldRemoveList =
      hasSelectedContent && lines.every((line) => isCurrentMarker(line));

    let formattedLineIndex = 0;

    return transformSelectedLines(
      state,
      range,
      (line) => {
        if (hasSelectedContent && !line.trim()) {
          return line;
        }

        const marker = markerForLine(formattedLineIndex);
        formattedLineIndex += 1;

        const indentation = blockPrefix(line);
        const content = stripBlockMarker(stripListMarker(line))
          .slice(indentation.length)
          .trimStart();

        if (shouldRemoveList) {
          return `${indentation}${content}`;
        }

        return `${indentation}${marker}${content || fallback}`;
      },
      {
        selectText: !hasSelectedContent && !shouldRemoveList
          ? fallback
          : undefined,
      },
    );
  });
}

function insertBlockReplacement(
  state: EditorState,
  range: SelectionRange,
  block: string,
  selectStart: number,
  selectEnd: number,
): Replacement {
  const previousChar = range.from > 0 ? state.sliceDoc(range.from - 1, range.from) : "";
  const nextChar = range.to < state.doc.length ? state.sliceDoc(range.to, range.to + 1) : "";
  const leadingBreak = previousChar && previousChar !== "\n" ? "\n\n" : "";
  const trailingBreak = nextChar && nextChar !== "\n" ? "\n\n" : "";
  const insert = `${leadingBreak}${block}${trailingBreak}`;
  const blockStart = range.from + leadingBreak.length;

  return {
    changes: {
      from: range.from,
      insert,
      to: range.to,
    },
    range: EditorSelection.range(blockStart + selectStart, blockStart + selectEnd),
  };
}

function lineIsHorizontalRule(line: string) {
  const content = line.slice(blockPrefix(line).length);

  return /^(-{3,}|\*{3,}|_{3,})\s*$/.test(content);
}

export function blockRemovalRange(
  value: string,
  blockFrom: number,
  blockTo: number,
) {
  const hasBlankLineBefore = blockFrom >= 2 &&
    value.slice(blockFrom - 2, blockFrom) === "\n\n";
  const hasBlankLineAfter = blockTo + 2 <= value.length &&
    value.slice(blockTo, blockTo + 2) === "\n\n";
  const hasLineBreakBefore = blockFrom > 0 && value[blockFrom - 1] === "\n";
  const hasLineBreakAfter = blockTo < value.length && value[blockTo] === "\n";

  if (hasBlankLineBefore && hasBlankLineAfter) {
    return {
      from: blockFrom,
      to: blockTo + 2,
    };
  }

  if (hasBlankLineBefore && hasLineBreakAfter) {
    return {
      from: blockFrom,
      to: blockTo + 1,
    };
  }

  if (hasBlankLineBefore && blockTo === value.length) {
    return {
      from: blockFrom - 2,
      to: blockTo,
    };
  }

  if (hasBlankLineAfter && hasLineBreakBefore) {
    return {
      from: blockFrom,
      to: blockTo + 1,
    };
  }

  if (hasBlankLineAfter && blockFrom === 0) {
    return {
      from: blockFrom,
      to: blockTo + 2,
    };
  }

  let from = blockFrom;
  let to = blockTo;

  if (from === blockFrom && to === blockTo) {
    if (hasLineBreakAfter) {
      to = blockTo + 1;
    } else if (hasLineBreakBefore) {
      from = blockFrom - 1;
    }
  }

  return {
    from,
    to,
  };
}

function horizontalRuleCommand(): StateCommand {
  return commandFromReplacement((state, range) => {
    const line = state.doc.lineAt(range.head);

    if (lineIsHorizontalRule(line.text)) {
      const removalRange = blockRemovalRange(
        state.doc.toString(),
        line.from,
        line.to,
      );

      return {
        changes: {
          from: removalRange.from,
          to: removalRange.to,
        },
        range: EditorSelection.cursor(removalRange.from),
      };
    }

    const previousChar = range.from > 0 ? state.sliceDoc(range.from - 1, range.from) : "";
    const nextChar = range.to < state.doc.length ? state.sliceDoc(range.to, range.to + 1) : "";
    const leadingBreak = previousChar && previousChar !== "\n" ? "\n\n" : "";
    const trailingBreak = nextChar && nextChar !== "\n" ? "\n\n" : "";
    const prefix = blockPrefix(line.text);
    const insert = `${leadingBreak}${prefix}---${trailingBreak}`;
    const blockStart = range.from + leadingBreak.length;

    return {
      changes: {
        from: range.from,
        insert,
        to: range.to,
      },
      range: EditorSelection.range(
        blockStart + prefix.length,
        blockStart + prefix.length + 3,
      ),
    };
  });
}

export function findFencedCodeBlockAtRange(
  state: EditorState,
  range: SelectionRange,
): FencedCodeBlock | null {
  let openingFence: {
    quotePrefix: string;
    contentFrom: number;
    from: number;
    marker: "`" | "~";
    size: number;
  } | null = null;

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    const fenceMatch = line.text.match(fencedCodeLinePattern);

    if (!fenceMatch) {
      continue;
    }

    const quotePrefix = fenceMatch[1] ?? "";
    const fence = fenceMatch[2] ?? "";
    const marker = fence[0] as "`" | "~";
    const remainder = fenceMatch[3] ?? "";

    if (!openingFence) {
      if (marker === "`" && remainder.includes("`")) {
        continue;
      }

      openingFence = {
        quotePrefix,
        contentFrom: line.to < state.doc.length ? line.to + 1 : line.to,
        from: line.from,
        marker,
        size: fence.length,
      };
      continue;
    }

    if (
      openingFence.quotePrefix !== quotePrefix ||
      openingFence.marker !== marker ||
      fence.length < openingFence.size ||
      !/^\s*$/.test(remainder)
    ) {
      continue;
    }

    const block = {
      contentFrom: openingFence.contentFrom,
      contentTo: Math.max(
        openingFence.contentFrom,
        line.from > openingFence.contentFrom ? line.from - 1 : line.from,
      ),
      from: openingFence.from,
      quotePrefix: openingFence.quotePrefix,
      to: line.to,
    };

    if (range.from >= block.from && range.to <= block.to) {
      return block;
    }

    openingFence = null;
  }

  if (openingFence) {
    const block = {
      contentFrom: openingFence.contentFrom,
      contentTo: Math.max(openingFence.contentFrom, state.doc.length),
      from: openingFence.from,
      quotePrefix: openingFence.quotePrefix,
      to: state.doc.length,
    };

    if (range.from >= block.from && range.to <= block.to) {
      return block;
    }
  }

  return null;
}

export function isRangeInFencedCodeBlock(
  state: EditorState,
  range: SelectionRange,
) {
  return findFencedCodeBlockAtRange(state, range) !== null;
}

function insertCodeBlock(): StateCommand {
  return commandFromReplacement((state, range) => {
    const existingCodeBlock = findFencedCodeBlockAtRange(state, range);

    if (existingCodeBlock) {
      const code = state.sliceDoc(
        existingCodeBlock.contentFrom,
        existingCodeBlock.contentTo,
      );

      return {
        changes: {
          from: existingCodeBlock.from,
          insert: code,
          to: existingCodeBlock.to,
        },
        range: EditorSelection.range(
          existingCodeBlock.from,
          existingCodeBlock.from + code.length,
        ),
      };
    }

    const currentText = selectedText(state, range);
    let prefix = blockPrefix(state.doc.lineAt(range.head).text);
    let replaceFrom = range.from;
    let replaceTo = range.to;
    let code = currentText || "code";

    if (currentText) {
      const selectedLineRange = lineRangeText(state, range);
      const selectedLines = selectedLineRange.text.split("\n");

      if (
        prefix &&
        selectedLines.every((line) => !line.trim() || line.startsWith(prefix))
      ) {
        replaceFrom = selectedLineRange.from;
        replaceTo = selectedLineRange.to;
        code = stripBlockLinePrefix(selectedLineRange.text, prefix);
      } else if (
        selectedLines.length > 1 &&
        selectedLines.some((line) => blockPrefix(line) !== prefix)
      ) {
        prefix = "";
        replaceFrom = selectedLineRange.from;
        replaceTo = selectedLineRange.to;
        code = selectedLineRange.text;
      }
    }

    const longestBacktickRun = Math.max(
      0,
      ...Array.from(code.matchAll(/`+/g), (match) => match[0].length),
    );
    const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
    const previousChar = replaceFrom > 0 ? state.sliceDoc(replaceFrom - 1, replaceFrom) : "";
    const nextChar = replaceTo < state.doc.length ? state.sliceDoc(replaceTo, replaceTo + 1) : "";
    const leadingBreak = previousChar && previousChar !== "\n" ? "\n\n" : "";
    const trailingBreak = nextChar && nextChar !== "\n" ? "\n\n" : "";
    const prefixedCode = prefixBlockLines(code, prefix);
    const insert = `${leadingBreak}${prefix}${fence}\n${prefixedCode}\n${prefix}${fence}${trailingBreak}`;
    const blockStart = replaceFrom + leadingBreak.length;
    const selectionStart = blockStart + prefix.length + fence.length + 1 + prefix.length;
    const selectionLength = prefixedCode.length - prefix.length;

    return {
      changes: {
        from: replaceFrom,
        insert,
        to: replaceTo,
      },
      range: EditorSelection.range(selectionStart, selectionStart + selectionLength),
    };
  });
}

function selectedActiveLines(state: EditorState, range: SelectionRange) {
  const lines = selectedNonEmptyLines(state, range);

  if (lines.length > 0) {
    return lines;
  }

  return [state.doc.lineAt(range.head).text];
}

function rangeHasInlineWrapper(
  state: EditorState,
  range: SelectionRange,
  wrappers: InlineWrapper[],
) {
  const line = state.doc.lineAt(range.head);
  const lineText = line.text;
  const selectionStart = Math.min(range.from, range.to) - line.from;
  const selectionEnd = Math.max(range.from, range.to) - line.from;

  return wrappers.some((wrapper) => {
    if (selectedTextHasWrapper(state, range, wrapper)) {
      return true;
    }

    const suffix = wrapperSuffix(wrapper);
    const beforeStart = lineText.lastIndexOf(wrapper.prefix, selectionStart);
    const afterEnd = lineText.indexOf(suffix, selectionEnd);

    if (beforeStart === -1 || afterEnd === -1) {
      return false;
    }

    const prefixFrom = line.from + beforeStart;
    const prefixTo = prefixFrom + wrapper.prefix.length;
    const suffixFrom = line.from + afterEnd;
    const suffixTo = suffixFrom + suffix.length;

    return (
      suffixFrom >= prefixTo + 1 &&
      prefixTo <= Math.min(range.from, range.to) &&
      suffixFrom >= Math.max(range.from, range.to) &&
      hasValidDelimiterBoundary(
        state.doc.toString(),
        prefixFrom - 1,
        prefixTo,
        suffixFrom - 1,
        suffixTo,
        wrapper,
      )
    );
  });
}

function tableLineContent(line: string) {
  return line.slice(blockPrefix(line).length);
}

function lineIsTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
    tableLineContent(line),
  );
}

function lineCanBeTableRow(line: string) {
  return tableLineContent(line).trim().includes("|");
}

function lineHasBlockPrefix(line: string, prefix: string) {
  return blockPrefix(line) === prefix;
}

function prefixBlockLines(block: string, prefix: string) {
  if (!prefix) {
    return block;
  }

  return block
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function stripBlockLinePrefix(block: string, prefix: string) {
  if (!prefix) {
    return block;
  }

  return block
    .split("\n")
    .map((line) => line.startsWith(prefix) ? line.slice(prefix.length) : line)
    .join("\n");
}

function findTableAtRange(state: EditorState, range: SelectionRange): MarkdownTable | null {
  const currentLine = state.doc.lineAt(range.head);
  const tablePrefix = blockPrefix(currentLine.text);
  let separatorLineNumber: number | null = null;

  for (let lineNumber = currentLine.number; lineNumber >= 1; lineNumber -= 1) {
    const line = state.doc.line(lineNumber);

    if (!lineHasBlockPrefix(line.text, tablePrefix)) {
      break;
    }

    if (lineIsTableSeparator(line.text)) {
      separatorLineNumber = lineNumber;
      break;
    }

    if (!lineCanBeTableRow(line.text)) {
      break;
    }
  }

  if (
    separatorLineNumber === null &&
    currentLine.number < state.doc.lines &&
    lineCanBeTableRow(currentLine.text) &&
    lineHasBlockPrefix(state.doc.line(currentLine.number + 1).text, tablePrefix) &&
    lineIsTableSeparator(state.doc.line(currentLine.number + 1).text)
  ) {
    separatorLineNumber = currentLine.number + 1;
  }

  if (separatorLineNumber === null || separatorLineNumber === 1) {
    return null;
  }

  const headerLine = state.doc.line(separatorLineNumber - 1);

  if (
    !lineHasBlockPrefix(headerLine.text, tablePrefix) ||
    !lineCanBeTableRow(headerLine.text)
  ) {
    return null;
  }

  let endLineNumber = separatorLineNumber;

  for (
    let lineNumber = separatorLineNumber + 1;
    lineNumber <= state.doc.lines;
    lineNumber += 1
  ) {
    const line = state.doc.line(lineNumber);

    if (
      !lineHasBlockPrefix(line.text, tablePrefix) ||
      !lineCanBeTableRow(line.text)
    ) {
      break;
    }

    endLineNumber = lineNumber;
  }

  const from = headerLine.from;
  const to = state.doc.line(endLineNumber).to;

  if (range.from < from || range.to > to) {
    return null;
  }

  return {
    from,
    to,
  };
}

function tableCommand(): StateCommand {
  return commandFromReplacement((state, range) => {
    const table = findTableAtRange(state, range);
    const tableBlock = prefixBlockLines(
      "| Column | Value |\n| --- | --- |\n| Item | Detail |",
      blockPrefix(state.doc.lineAt(range.head).text),
    );
    const firstCellStart = tableBlock.indexOf("Column");
    const firstCellEnd = firstCellStart + "Column".length;

    if (table) {
      return {
        changes: [],
        range: EditorSelection.range(table.from, table.to),
      };
    }

    return insertBlockReplacement(state, range, tableBlock, firstCellStart, firstCellEnd);
  });
}

function isEscaped(value: string, index: number) {
  let slashCount = 0;

  for (let position = index - 1; position >= 0 && value[position] === "\\"; position -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function findUnescapedCharacter(value: string, start: number, character: string) {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === character && !isEscaped(value, index)) {
      return index;
    }
  }

  return -1;
}

function findLinkDestinationEnd(value: string, start: number) {
  if (value[start] === "<" && !isEscaped(value, start)) {
    const closingAngle = findUnescapedCharacter(value, start + 1, ">");

    return closingAngle !== -1 && value[closingAngle + 1] === ")"
      ? closingAngle + 1
      : -1;
  }

  let depth = 1;

  for (let index = start; index < value.length; index += 1) {
    if (isEscaped(value, index)) {
      continue;
    }

    if (value[index] === "(") {
      depth += 1;
      continue;
    }

    if (value[index] === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

export function linkLikeSyntaxAtRange(
  state: EditorState,
  range: SelectionRange,
): LinkLikeSyntax | null {
  const line = state.doc.lineAt(range.head);
  let searchStart = 0;

  while (searchStart < line.text.length) {
    const bracketStart = line.text.indexOf("[", searchStart);

    if (bracketStart === -1) {
      return null;
    }

    if (isEscaped(line.text, bracketStart)) {
      searchStart = bracketStart + 1;
      continue;
    }

    const type =
      bracketStart > 0 &&
        line.text[bracketStart - 1] === "!" &&
        !isEscaped(line.text, bracketStart - 1)
        ? "image"
        : "link";
    const syntaxStart = type === "image" ? bracketStart - 1 : bracketStart;
    const labelStart = bracketStart + 1;
    const labelEnd = findUnescapedCharacter(line.text, labelStart, "]");

    if (
      labelEnd === -1 ||
      line.text[labelEnd + 1] !== "("
    ) {
      searchStart = bracketStart + 1;
      continue;
    }

    const urlStart = labelEnd + 2;
    const urlEnd = findLinkDestinationEnd(line.text, urlStart);

    if (urlEnd === -1) {
      searchStart = labelEnd + 1;
      continue;
    }

    const from = line.from + syntaxStart;
    const to = line.from + urlEnd + 1;

    const isCursor = range.from === range.to;
    const isInsideSyntax = isCursor
      ? range.from > from && range.to < to
      : range.from >= from && range.to <= to;

    if (isInsideSyntax) {
      return {
        from,
        labelFrom: line.from + labelStart,
        labelTo: line.from + labelEnd,
        to,
        type,
        urlFrom: line.from + urlStart,
        urlTo: line.from + urlEnd,
      };
    }

    searchStart = urlEnd + 1;
  }

  return null;
}

function escapeLinkLikeLabel(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function createLinkLikeLabel(value: string, fallback: string) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  return normalizedValue ? escapeLinkLikeLabel(normalizedValue) : fallback;
}

function rangeWithoutSelectedLinePrefix(state: EditorState, range: SelectionRange) {
  const selectedLine = state.doc.lineAt(range.from);
  const selectedLinePrefix = structuralInlinePrefix(selectedLine.text);
  const rawText = selectedText(state, range);
  const shouldPreserveLinePrefix =
    selectedLinePrefix &&
    range.from === selectedLine.from &&
    range.to <= selectedLine.to &&
    rawText.startsWith(selectedLinePrefix);

  return {
    currentText: shouldPreserveLinePrefix
      ? rawText.slice(selectedLinePrefix.length)
      : rawText,
    range: shouldPreserveLinePrefix
      ? EditorSelection.range(range.from + selectedLinePrefix.length, range.to)
      : range,
    replaceFrom: shouldPreserveLinePrefix
      ? range.from + selectedLinePrefix.length
      : range.from,
  };
}

function insertLinkLike(kind: "image" | "link"): StateCommand {
  return commandFromReplacement((state, range) => {
    const {
      currentText,
      range: effectiveRange,
      replaceFrom,
    } = rangeWithoutSelectedLinePrefix(state, range);
    const existingSyntax = linkLikeSyntaxAtRange(state, effectiveRange);

    if (existingSyntax?.type === kind) {
      return {
        changes: [],
        range: EditorSelection.range(existingSyntax.urlFrom, existingSyntax.urlTo),
      };
    }

    if (existingSyntax) {
      if (kind === "image") {
        return {
          changes: {
            from: existingSyntax.from,
            insert: "!",
          },
          range: EditorSelection.range(
            existingSyntax.urlFrom + 1,
            existingSyntax.urlTo + 1,
          ),
        };
      }

      return {
        changes: {
          from: existingSyntax.from,
          to: existingSyntax.from + 1,
        },
        range: EditorSelection.range(
          existingSyntax.urlFrom - 1,
          existingSyntax.urlTo - 1,
        ),
      };
    }

    const selectedUrl = isHttpUrl(currentText) ? currentText : null;
    const label = selectedUrl
      ? kind === "image" ? "image description" : "link text"
      : createLinkLikeLabel(
        currentText,
        kind === "image" ? "image description" : "link text",
      );
    const url = selectedUrl ? markdownLinkDestination(selectedUrl) : "https://";
    const prefix = kind === "image" ? "![" : "[";
    const insert = `${prefix}${label}](${url})`;
    const labelStart = replaceFrom + prefix.length;
    const urlStart = replaceFrom + prefix.length + label.length + 2;

    return {
      changes: {
        from: replaceFrom,
        insert,
        to: range.to,
      },
      range: currentText && !selectedUrl
        ? EditorSelection.range(urlStart, urlStart + url.length)
        : EditorSelection.range(labelStart, labelStart + label.length),
    };
  });
}

export function getActiveMarkdownCommands(state: EditorState) {
  const range = state.selection.main;
  const lines = selectedActiveLines(state, range);
  const activeCommands = new Set<MarkdownCommandName>();
  const isInCodeBlock = isRangeInFencedCodeBlock(state, range);
  const effectiveInlineRange = rangeWithoutSelectedLinePrefix(state, range).range;
  const linkLikeSyntax = linkLikeSyntaxAtRange(state, effectiveInlineRange)?.type ?? null;

  if (isInCodeBlock) {
    activeCommands.add("codeBlock");
    return activeCommands;
  }

  if (lines.every((line) => hasHeadingMarker(line, 1))) {
    activeCommands.add("heading1");
  } else if (lines.every((line) => hasHeadingMarker(line, 2))) {
    activeCommands.add("heading2");
  } else if (lines.every((line) => hasHeadingMarker(line, 3))) {
    activeCommands.add("heading3");
  }

  if (lines.every(hasQuoteMarker)) {
    activeCommands.add("quote");
  }

  if (lines.every(hasUnorderedListMarker)) {
    activeCommands.add("bulletList");
  }

  if (lines.every(hasOrderedListMarker)) {
    activeCommands.add("orderedList");
  }

  if (lines.every(hasTaskListMarker)) {
    activeCommands.add("taskList");
  }

  if (
    rangeHasInlineWrapper(state, effectiveInlineRange, [
      createInlineWrapper("**"),
      createInlineWrapper("__"),
    ])
  ) {
    activeCommands.add("bold");
  }

  if (
    rangeHasInlineWrapper(state, effectiveInlineRange, [
      createInlineWrapper("_"),
      createInlineWrapper("*"),
    ])
  ) {
    activeCommands.add("italic");
  }

  if (rangeHasInlineWrapper(state, effectiveInlineRange, [createInlineWrapper("~~")])) {
    activeCommands.add("strikethrough");
  }

  if (
    rangeHasInlineWrapper(
      state,
      effectiveInlineRange,
      inlineCodeWrappers(state, effectiveInlineRange),
    )
  ) {
    activeCommands.add("inlineCode");
  }

  if (linkLikeSyntax === "link") {
    activeCommands.add("link");
  }

  if (linkLikeSyntax === "image") {
    activeCommands.add("image");
  }

  if (findTableAtRange(state, range)) {
    activeCommands.add("table");
  }

  if (lines.every(lineIsHorizontalRule)) {
    activeCommands.add("horizontalRule");
  }

  if (
    ![
      "heading1",
      "heading2",
      "heading3",
      "quote",
      "bulletList",
      "orderedList",
      "taskList",
      "codeBlock",
      "table",
      "horizontalRule",
    ].some((commandName) => activeCommands.has(commandName as MarkdownCommandName))
  ) {
    activeCommands.add("paragraph");
  }

  return activeCommands;
}

export const markdownCommands: Record<MarkdownCommandName, StateCommand> = {
  bold: wrapSelection("**", "**", "strong text", [createInlineWrapper("__")]),
  bulletList: listCommand(() => "- ", "List item", hasUnorderedListMarker),
  codeBlock: insertCodeBlock(),
  heading1: setHeading(1),
  heading2: setHeading(2),
  heading3: setHeading(3),
  horizontalRule: horizontalRuleCommand(),
  image: insertLinkLike("image"),
  inlineCode: inlineCodeCommand(),
  italic: wrapSelection("_", "_", "emphasized text", [createInlineWrapper("*")]),
  link: insertLinkLike("link"),
  orderedList: listCommand(
    (index) => `${index + 1}. `,
    "List item",
    hasOrderedListMarker,
  ),
  paragraph: setHeading(0),
  quote: commandFromReplacement((state, range) => {
    const lines = selectedNonEmptyLines(state, range);
    const hasSelectedContent = lines.length > 0;
    const shouldRemoveQuote =
      hasSelectedContent && lines.every((line) => hasQuoteMarker(line));

    return transformSelectedLines(
      state,
      range,
      (line) => {
        if (hasSelectedContent && !line.trim()) {
          return line;
        }

        const unquotedContent = stripQuoteMarker(line);

        if (shouldRemoveQuote) {
          return unquotedContent;
        }

        return `> ${line.trim() ? line : "Quote"}`;
      },
      {
        selectText: !hasSelectedContent && !shouldRemoveQuote
          ? "Quote"
          : undefined,
      },
    );
  }),
  strikethrough: wrapSelection("~~", "~~", "deleted text"),
  table: tableCommand(),
  taskList: listCommand(() => "- [ ] ", "Task", hasTaskListMarker),
};

export function runMarkdownCommand(
  view: {
    dispatch: (transaction: Transaction) => void;
    focus: () => void;
    state: EditorState;
  },
  commandName: MarkdownCommandName,
) {
  view.focus();

  if (
    commandName !== "codeBlock" &&
    isRangeInFencedCodeBlock(view.state, view.state.selection.main)
  ) {
    return false;
  }

  return markdownCommands[commandName](view);
}
