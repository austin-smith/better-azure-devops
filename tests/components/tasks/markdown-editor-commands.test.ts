import { EditorState, Transaction, type TransactionSpec } from "@codemirror/state";
import {
  getActiveMarkdownCommands,
  markdownCommands,
  runMarkdownCommand,
  type MarkdownCommandName,
} from "@/components/tasks/markdown-editor/commands";
import {
  markdownEditorKeymap,
  pasteHtmlAsMarkdown,
  pasteTextPreservingLinePrefix,
  pasteUrlOverSelectionAsMarkdownLink,
} from "@/components/tasks/markdown-editor/extensions";

function runCommand(
  commandName: MarkdownCommandName,
  doc: string,
  anchor: number,
  head = anchor,
) {
  let nextState = EditorState.create({
    doc,
    selection: {
      anchor,
      head,
    },
  });

  markdownCommands[commandName]({
    dispatch: (transaction) => {
      nextState = transaction.state;
    },
    state: nextState,
  });

  return {
    doc: nextState.doc.toString(),
    selection: nextState.selection.main,
  };
}

function activeCommands(doc: string, anchor: number, head = anchor) {
  return getActiveMarkdownCommands(EditorState.create({
    doc,
    selection: {
      anchor,
      head,
    },
  }));
}

function runViewCommand(
  commandName: MarkdownCommandName,
  doc: string,
  anchor: number,
  head = anchor,
) {
  let nextState = EditorState.create({
    doc,
    selection: {
      anchor,
      head,
    },
  });
  const focus = vi.fn();
  const handled = runMarkdownCommand({
    dispatch: (transaction) => {
      nextState = transaction.state;
    },
    focus,
    state: nextState,
  }, commandName);

  return {
    doc: nextState.doc.toString(),
    focus,
    handled,
    selection: nextState.selection.main,
  };
}

function runKeyBinding(
  key: string,
  doc: string,
  anchor: number,
  head = anchor,
  options: {
    readOnly?: boolean;
  } = {},
) {
  const binding = markdownEditorKeymap.find((candidate) => candidate.key === key);
  let nextState = EditorState.create({
    doc,
    extensions: options.readOnly ? [EditorState.readOnly.of(true)] : [],
    selection: {
      anchor,
      head,
    },
  });

  const handled = binding?.run({
    dispatch: (transaction) => {
      nextState = transaction.state;
    },
    state: nextState,
  }) ?? false;

  return {
    doc: nextState.doc.toString(),
    handled,
    selection: nextState.selection.main,
  };
}

function isTransactionArray(
  transaction: Transaction | TransactionSpec | readonly Transaction[],
): transaction is readonly Transaction[] {
  return Array.isArray(transaction);
}

function pasteUrlOverSelection(
  doc: string,
  anchor: number,
  head: number,
  pastedText: string,
  options: {
    readOnly?: boolean;
  } = {},
) {
  let nextState = EditorState.create({
    doc,
    extensions: options.readOnly ? [EditorState.readOnly.of(true)] : [],
    selection: {
      anchor,
      head,
    },
  });
  const handled = pasteUrlOverSelectionAsMarkdownLink({
    dispatch: (transaction) => {
      if (transaction instanceof Transaction) {
        nextState = transaction.state;
        return;
      }

      if (isTransactionArray(transaction)) {
        nextState = transaction.at(-1)?.state ?? nextState;
        return;
      }

      nextState = nextState.update(transaction).state;
    },
    state: nextState,
  }, pastedText);

  return {
    doc: nextState.doc.toString(),
    handled,
    selection: nextState.selection.main,
  };
}

function pasteHtmlOverSelection(
  doc: string,
  anchor: number,
  head: number,
  pastedHtml: string,
  options: {
    readOnly?: boolean;
  } = {},
) {
  let nextState = EditorState.create({
    doc,
    extensions: options.readOnly ? [EditorState.readOnly.of(true)] : [],
    selection: {
      anchor,
      head,
    },
  });
  const handled = pasteHtmlAsMarkdown({
    dispatch: (transaction) => {
      if (transaction instanceof Transaction) {
        nextState = transaction.state;
        return;
      }

      if (isTransactionArray(transaction)) {
        nextState = transaction.at(-1)?.state ?? nextState;
        return;
      }

      nextState = nextState.update(transaction).state;
    },
    state: nextState,
  }, pastedHtml);

  return {
    doc: nextState.doc.toString(),
    handled,
    selection: nextState.selection.main,
  };
}

function pasteTextOverSelection(
  doc: string,
  anchor: number,
  head: number,
  pastedText: string,
  options: {
    readOnly?: boolean;
  } = {},
) {
  let nextState = EditorState.create({
    doc,
    extensions: options.readOnly ? [EditorState.readOnly.of(true)] : [],
    selection: {
      anchor,
      head,
    },
  });
  const handled = pasteTextPreservingLinePrefix({
    dispatch: (transaction) => {
      if (transaction instanceof Transaction) {
        nextState = transaction.state;
        return;
      }

      if (isTransactionArray(transaction)) {
        nextState = transaction.at(-1)?.state ?? nextState;
        return;
      }

      nextState = nextState.update(transaction).state;
    },
    state: nextState,
  }, pastedText);

  return {
    doc: nextState.doc.toString(),
    handled,
    selection: nextState.selection.main,
  };
}

describe("markdownCommands", () => {
  it("wraps selected text and keeps the wrapped content selected", () => {
    const result = runCommand("bold", "Fix login flow", 4, 9);

    expect(result.doc).toBe("Fix **login** flow");
    expect(result.selection.from).toBe(6);
    expect(result.selection.to).toBe(11);
  });

  it("toggles inline formatting when the selected text is already formatted", () => {
    expect(runCommand("bold", "**login**", 0, 9).doc).toBe("login");
    expect(runCommand("bold", "__login__", 0, 9).doc).toBe("login");
    expect(runCommand("italic", "_login_", 0, 7).doc).toBe("login");
    expect(runCommand("italic", "*login*", 0, 7).doc).toBe("login");
    expect(runCommand("strikethrough", "~~login~~", 0, 9).doc).toBe("login");
    expect(runCommand("inlineCode", "`login`", 0, 7).doc).toBe("login");
    expect(runCommand("inlineCode", "``login``", 0, 9).doc).toBe("login");
  });

  it("toggles inline formatting around the selected content", () => {
    const result = runCommand("bold", "**login**", 2, 7);

    expect(result.doc).toBe("login");
    expect(result.selection.from).toBe(0);
    expect(result.selection.to).toBe(5);

    expect(runCommand("bold", "__login__", 2, 7).doc).toBe("login");
    expect(runCommand("italic", "*login*", 1, 6).doc).toBe("login");
    expect(runCommand("inlineCode", "``login``", 2, 7).doc).toBe("login");
  });

  it("preserves quote context when formatting fully selected quoted lines", () => {
    const boldResult = runCommand("bold", "> Azure DevOps", 0, 14);
    const italicResult = runCommand("italic", "> Azure DevOps", 0, 14);
    const strikeResult = runCommand("strikethrough", "> Azure DevOps", 0, 14);
    const codeResult = runCommand("inlineCode", "> Azure DevOps", 0, 14);

    expect(boldResult.doc).toBe("> **Azure DevOps**");
    expect(boldResult.doc.slice(boldResult.selection.from, boldResult.selection.to))
      .toBe("Azure DevOps");
    expect(italicResult.doc).toBe("> _Azure DevOps_");
    expect(italicResult.doc.slice(italicResult.selection.from, italicResult.selection.to))
      .toBe("Azure DevOps");
    expect(strikeResult.doc).toBe("> ~~Azure DevOps~~");
    expect(strikeResult.doc.slice(strikeResult.selection.from, strikeResult.selection.to))
      .toBe("Azure DevOps");
    expect(codeResult.doc).toBe("> `Azure DevOps`");
    expect(codeResult.doc.slice(codeResult.selection.from, codeResult.selection.to))
      .toBe("Azure DevOps");
  });

  it("preserves indentation when formatting fully selected indented lines", () => {
    const result = runCommand("bold", "  Azure DevOps", 0, 14);

    expect(result.doc).toBe("  **Azure DevOps**");
    expect(result.doc.slice(result.selection.from, result.selection.to))
      .toBe("Azure DevOps");
  });

  it("preserves list markers when formatting fully selected list lines", () => {
    expect(runCommand("bold", "- Azure DevOps", 0, 14).doc).toBe(
      "- **Azure DevOps**",
    );
    expect(runCommand("italic", "1. Azure DevOps", 0, 15).doc).toBe(
      "1. _Azure DevOps_",
    );
    expect(runCommand("strikethrough", "- [ ] Azure DevOps", 0, 18).doc).toBe(
      "- [ ] ~~Azure DevOps~~",
    );
    expect(runCommand("inlineCode", "> - Azure DevOps", 0, 16).doc).toBe(
      "> - `Azure DevOps`",
    );
  });

  it("formats multiline quoted selections without formatting quote markers", () => {
    expect(runCommand("bold", "> First\n> Second", 0, 16).doc).toBe(
      "> **First**\n> **Second**",
    );
    expect(runCommand("italic", "> First\n> Second", 0, 16).doc).toBe(
      "> _First_\n> _Second_",
    );
    expect(runCommand("strikethrough", "> First\n> Second", 0, 16).doc).toBe(
      "> ~~First~~\n> ~~Second~~",
    );
    expect(runCommand("inlineCode", "> First\n> Second", 0, 16).doc).toBe(
      "> `First`\n> `Second`",
    );
  });

  it("formats multiline list selections without formatting list markers", () => {
    expect(runCommand("bold", "- First\n- Second", 0, 16).doc).toBe(
      "- **First**\n- **Second**",
    );
    expect(runCommand("inlineCode", "> - First\n> - Second", 0, 20).doc).toBe(
      "> - `First`\n> - `Second`",
    );
  });

  it("toggles multiline quoted inline formatting without removing quote markers", () => {
    expect(runCommand("bold", "> **First**\n> **Second**", 0, 24).doc).toBe(
      "> First\n> Second",
    );
    expect(runCommand("italic", "> _First_\n> _Second_", 0, 20).doc).toBe(
      "> First\n> Second",
    );
    expect(runCommand("inlineCode", "> `First`\n> `Second`", 0, 20).doc).toBe(
      "> First\n> Second",
    );
  });

  it("toggles inline formatting inside fully selected quoted lines", () => {
    expect(runCommand("bold", "> **Azure DevOps**", 0, 18).doc).toBe(
      "> Azure DevOps",
    );
    expect(runCommand("italic", "> _Azure DevOps_", 0, 16).doc).toBe(
      "> Azure DevOps",
    );
    expect(runCommand("strikethrough", "> ~~Azure DevOps~~", 0, 18).doc).toBe(
      "> Azure DevOps",
    );
    expect(runCommand("inlineCode", "> `Azure DevOps`", 0, 16).doc).toBe(
      "> Azure DevOps",
    );
  });

  it("uses longer inline code delimiters when selected code contains backticks", () => {
    const result = runCommand("inlineCode", "const value = `draft`", 0, 21);

    expect(result.doc).toBe("``const value = `draft```");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "const value = `draft`",
    );
  });

  it("toggles inline code spans with generated long delimiters", () => {
    const result = runCommand("inlineCode", "```````code```````", 0, 18);

    expect(result.doc).toBe("code");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "code",
    );
  });

  it("formats multi-line selections as task list items", () => {
    const result = runCommand("taskList", "Write tests\nShip editor", 0, 23);

    expect(result.doc).toBe("- [ ] Write tests\n- [ ] Ship editor");
  });

  it("selects placeholder text when inserting empty block formatting", () => {
    const headingResult = runCommand("heading2", "", 0);
    const bulletResult = runCommand("bulletList", "", 0);
    const orderedResult = runCommand("orderedList", "", 0);
    const taskResult = runCommand("taskList", "", 0);
    const quoteResult = runCommand("quote", "", 0);

    expect(headingResult.doc).toBe("## Heading");
    expect(headingResult.doc.slice(
      headingResult.selection.from,
      headingResult.selection.to,
    )).toBe("Heading");
    expect(bulletResult.doc).toBe("- List item");
    expect(bulletResult.doc.slice(
      bulletResult.selection.from,
      bulletResult.selection.to,
    )).toBe("List item");
    expect(orderedResult.doc).toBe("1. List item");
    expect(orderedResult.doc.slice(
      orderedResult.selection.from,
      orderedResult.selection.to,
    )).toBe("List item");
    expect(taskResult.doc).toBe("- [ ] Task");
    expect(taskResult.doc.slice(taskResult.selection.from, taskResult.selection.to))
      .toBe("Task");
    expect(quoteResult.doc).toBe("> Quote");
    expect(quoteResult.doc.slice(
      quoteResult.selection.from,
      quoteResult.selection.to,
    )).toBe("Quote");
  });

  it("does not format the next line when a selection ends at that line start", () => {
    expect(runCommand("bulletList", "Plan\nShip", 0, 5).doc).toBe(
      "- Plan\nShip",
    );
    expect(runCommand("heading2", "Plan\nShip", 0, 5).doc).toBe(
      "## Plan\nShip",
    );
    expect(runCommand("quote", "Plan\nShip", 0, 5).doc).toBe(
      "> Plan\nShip",
    );
    expect(runCommand("taskList", "Plan\nShip", 0, 5).doc).toBe(
      "- [ ] Plan\nShip",
    );
  });

  it("toggles horizontal rules off without damaging surrounding content", () => {
    expect(runCommand("horizontalRule", "---", 1).doc).toBe("");
    expect(runCommand("horizontalRule", "> ---", 3).doc).toBe("");
    expect(runCommand("horizontalRule", "Before\n---\nAfter", 8).doc).toBe(
      "Before\nAfter",
    );
    expect(runCommand("horizontalRule", "> Before\n> ---\n> After", 12).doc).toBe(
      "> Before\n> After",
    );
    expect(runCommand("horizontalRule", "Before\n---", 8).doc).toBe("Before");
    expect(runCommand("horizontalRule", "Before\n\n---", 9).doc).toBe("Before");
    expect(runCommand("horizontalRule", "---\n\nAfter", 1).doc).toBe("After");
    expect(runCommand("horizontalRule", "Before\n\n---\n\nAfter", 9).doc).toBe(
      "Before\n\nAfter",
    );
    expect(runCommand("horizontalRule", "Before\n\n---\nAfter", 9).doc).toBe(
      "Before\n\nAfter",
    );
    expect(runCommand("horizontalRule", "Before\n---\n\nAfter", 8).doc).toBe(
      "Before\n\nAfter",
    );
    expect(runCommand("horizontalRule", "> Before\n\n> ---", 12).doc).toBe(
      "> Before",
    );
  });

  it("preserves quote context when inserting horizontal rules", () => {
    const result = runCommand("horizontalRule", "> Quote", 7);

    expect(result.doc).toBe("> Quote\n\n> ---");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "---",
    );
  });

  it("selects the existing table instead of inserting another table inside it", () => {
    const doc = "Before\n| Column | Value |\n| --- | --- |\n| Item | Detail |\nAfter";
    const result = runCommand("table", doc, 35);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "| Column | Value |\n| --- | --- |\n| Item | Detail |",
    );
  });

  it("recognizes and inserts tables inside quotes", () => {
    const quotedTable = [
      "> | Column | Value |",
      "> | --- | --- |",
      "> | Item | Detail |",
    ].join("\n");
    const existingResult = runCommand("table", quotedTable, quotedTable.indexOf("Item"));
    const insertResult = runCommand("table", "> Quote", 7);

    expect(existingResult.doc).toBe(quotedTable);
    expect(
      existingResult.doc.slice(
        existingResult.selection.from,
        existingResult.selection.to,
      ),
    ).toBe(quotedTable);
    expect(insertResult.doc).toBe([
      "> Quote",
      "",
      "> | Column | Value |",
      "> | --- | --- |",
      "> | Item | Detail |",
    ].join("\n"));
  });

  it("selects the first header cell when inserting a table", () => {
    const result = runCommand("table", "Before", 6);

    expect(result.doc).toBe([
      "Before",
      "",
      "| Column | Value |",
      "| --- | --- |",
      "| Item | Detail |",
    ].join("\n"));
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "Column",
    );
  });

  it("selects the first header cell when inserting a quoted table", () => {
    const result = runCommand("table", "> Quote", 7);

    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "Column",
    );
  });

  it("does not group table rows across different quote contexts", () => {
    const mixedTable = [
      "> | Column | Value |",
      "| --- | --- |",
      "> | Item | Detail |",
    ].join("\n");

    expect(activeCommands(mixedTable, mixedTable.indexOf("Item")).has("table"))
      .toBe(false);
  });

  it("preserves blank separator lines when formatting block selections", () => {
    expect(runCommand("bulletList", "Plan\n\nShip", 0, 10).doc).toBe(
      "- Plan\n\n- Ship",
    );
    expect(runCommand("orderedList", "Plan\n\nShip", 0, 10).doc).toBe(
      "1. Plan\n\n2. Ship",
    );
    expect(runCommand("heading2", "Plan\n\nShip", 0, 10).doc).toBe(
      "## Plan\n\n## Ship",
    );
    expect(runCommand("quote", "Plan\n\nShip", 0, 10).doc).toBe(
      "> Plan\n\n> Ship",
    );
    expect(runCommand("taskList", "Plan\n\nShip", 0, 10).doc).toBe(
      "- [ ] Plan\n\n- [ ] Ship",
    );
  });

  it("replaces existing block markers when changing block style", () => {
    expect(runCommand("heading2", "- Existing list item", 0).doc).toBe(
      "## Existing list item",
    );
    expect(runCommand("paragraph", "### Existing heading", 0).doc).toBe(
      "Existing heading",
    );
    expect(runCommand("orderedList", "> Existing quote", 0).doc).toBe(
      "> 1. Existing quote",
    );
    expect(runCommand("quote", "- Existing list item", 0).doc).toBe(
      "> - Existing list item",
    );
    expect(runCommand("quote", "## Existing heading", 0).doc).toBe(
      "> ## Existing heading",
    );
    expect(runCommand("quote", "- [ ] Existing task", 0).doc).toBe(
      "> - [ ] Existing task",
    );
    expect(runCommand("taskList", "1. [ ] Existing ordered task", 0).doc).toBe(
      "Existing ordered task",
    );
    expect(runCommand("orderedList", "1. [ ] Existing ordered task", 0).doc).toBe(
      "1. Existing ordered task",
    );
  });

  it("toggles block markers when the selected lines already use the same style", () => {
    expect(runCommand("heading2", "## Existing heading", 0).doc).toBe(
      "Existing heading",
    );
    expect(runCommand("bulletList", "- Existing list item", 0).doc).toBe(
      "Existing list item",
    );
    expect(runCommand("orderedList", "1. Existing list item", 0).doc).toBe(
      "Existing list item",
    );
    expect(runCommand("taskList", "- [ ] Existing task", 0).doc).toBe(
      "Existing task",
    );
    expect(runCommand("taskList", "1. [ ] Existing ordered task", 0).doc).toBe(
      "Existing ordered task",
    );
    expect(runCommand("taskList", "- [ ]", 0).doc).toBe("");
    expect(runCommand("taskList", "1. [ ]", 0).doc).toBe("");
    expect(runCommand("quote", "> Existing quote", 0).doc).toBe(
      "Existing quote",
    );
    expect(runCommand("quote", "> - Existing list item", 0).doc).toBe(
      "- Existing list item",
    );
    expect(runCommand("quote", "> 1. Existing list item", 0).doc).toBe(
      "1. Existing list item",
    );
    expect(runCommand("quote", "> - [ ] Existing task", 0).doc).toBe(
      "- [ ] Existing task",
    );
  });

  it("preserves content indentation when toggling quotes", () => {
    expect(runCommand("quote", "  - Nested list item", 0).doc).toBe(
      ">   - Nested list item",
    );
    expect(runCommand("quote", ">   - Nested list item", 0).doc).toBe(
      "  - Nested list item",
    );
    expect(runCommand("quote", "    const value = true;", 0).doc).toBe(
      ">     const value = true;",
    );
    expect(runCommand("quote", ">     const value = true;", 0).doc).toBe(
      "    const value = true;",
    );
  });

  it("preserves quote context when applying or toggling block markers", () => {
    expect(runCommand("heading2", "> Existing quote", 0).doc).toBe(
      "> ## Existing quote",
    );
    expect(runCommand("bulletList", "> Existing quote", 0).doc).toBe(
      "> - Existing quote",
    );
    expect(runCommand("taskList", "> Existing quote", 0).doc).toBe(
      "> - [ ] Existing quote",
    );
    expect(runCommand("taskList", "> - [ ] Existing task", 0).doc).toBe(
      "> Existing task",
    );
    expect(runCommand("heading2", "> ## Existing heading", 0).doc).toBe(
      "> Existing heading",
    );
  });

  it("selects the url placeholder when linking selected text", () => {
    const result = runCommand("link", "Azure DevOps", 0, 12);

    expect(result.doc).toBe("[Azure DevOps](https://)");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://",
    );
  });

  it("preserves quote context when linking a fully selected quoted line", () => {
    const result = runCommand("link", "> Azure DevOps", 0, 14);

    expect(result.doc).toBe("> [Azure DevOps](https://)");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://",
    );
  });

  it("preserves list markers when linking fully selected list lines", () => {
    const bulletResult = runCommand("link", "- Azure DevOps", 0, 14);
    const taskResult = runCommand("link", "- [ ] Azure DevOps", 0, 18);
    const quotedResult = runCommand("image", "> - Azure DevOps", 0, 16);

    expect(bulletResult.doc).toBe("- [Azure DevOps](https://)");
    expect(bulletResult.doc.slice(bulletResult.selection.from, bulletResult.selection.to))
      .toBe("https://");
    expect(taskResult.doc).toBe("- [ ] [Azure DevOps](https://)");
    expect(taskResult.doc.slice(taskResult.selection.from, taskResult.selection.to))
      .toBe("https://");
    expect(quotedResult.doc).toBe("> - ![Azure DevOps](https://)");
    expect(quotedResult.doc.slice(quotedResult.selection.from, quotedResult.selection.to))
      .toBe("https://");
  });

  it("uses selected urls as link and image destinations", () => {
    const linkResult = runCommand("link", "https://example.com/docs/(draft)", 0, 32);

    expect(linkResult.doc).toBe("[link text](<https://example.com/docs/(draft)>)");
    expect(linkResult.doc.slice(linkResult.selection.from, linkResult.selection.to)).toBe(
      "link text",
    );

    const imageResult = runCommand("image", "https://example.com/image.png", 0, 29);

    expect(imageResult.doc).toBe("![image description](https://example.com/image.png)");
    expect(imageResult.doc.slice(imageResult.selection.from, imageResult.selection.to)).toBe(
      "image description",
    );
  });

  it("escapes selected link and image labels", () => {
    const linkResult = runCommand("link", "Build [API] docs", 0, 16);

    expect(linkResult.doc).toBe("[Build \\[API\\] docs](https://)");
    expect(linkResult.doc.slice(linkResult.selection.from, linkResult.selection.to)).toBe(
      "https://",
    );

    const imageResult = runCommand("image", "Path \\ [draft]", 0, 14);

    expect(imageResult.doc).toBe("![Path \\\\ \\[draft\\]](https://)");
    expect(imageResult.doc.slice(imageResult.selection.from, imageResult.selection.to)).toBe(
      "https://",
    );
  });

  it("normalizes multi-line link and image labels", () => {
    const linkResult = runCommand("link", "First line\nSecond line", 0, 22);

    expect(linkResult.doc).toBe("[First line Second line](https://)");
    expect(linkResult.doc.slice(linkResult.selection.from, linkResult.selection.to)).toBe(
      "https://",
    );

    const imageResult = runCommand("image", "  First\n\nSecond  ", 0, 17);

    expect(imageResult.doc).toBe("![First Second](https://)");
    expect(imageResult.doc.slice(imageResult.selection.from, imageResult.selection.to)).toBe(
      "https://",
    );
  });

  it("selects the existing url when linking inside an existing link", () => {
    const doc = "[Azure DevOps](https://example.com)";
    const result = runCommand("link", doc, 4);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com",
    );
  });

  it("selects the existing url when linking a fully selected quoted link line", () => {
    const doc = "> [Azure DevOps](https://example.com)";
    const result = runCommand("link", doc, 0, doc.length);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com",
    );
  });

  it("treats escaped image markers as links, not images", () => {
    const doc = "\\![Diagram](https://example.com)";
    const result = runCommand("link", doc, 5);
    const commands = activeCommands(doc, 5);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com",
    );
    expect(commands.has("link")).toBe(true);
    expect(commands.has("image")).toBe(false);
  });

  it("does not treat escaped opening brackets as markdown links", () => {
    const doc = "\\[Not a link](https://example.com)";
    const commands = activeCommands(doc, 4);

    expect(commands.has("link")).toBe(false);
  });

  it("converts between existing markdown links and images", () => {
    const linkDoc = "[Azure DevOps](https://example.com)";
    const imageDoc = "![Diagram](https://example.com/image.png)";
    const imageResult = runCommand("image", linkDoc, 4);

    expect(imageResult.doc).toBe("![Azure DevOps](https://example.com)");
    expect(imageResult.doc.slice(imageResult.selection.from, imageResult.selection.to)).toBe(
      "https://example.com",
    );

    const linkResult = runCommand("link", imageDoc, 4);

    expect(linkResult.doc).toBe("[Diagram](https://example.com/image.png)");
    expect(linkResult.doc.slice(linkResult.selection.from, linkResult.selection.to)).toBe(
      "https://example.com/image.png",
    );
  });

  it("converts quoted markdown links and images without removing the quote", () => {
    const linkDoc = "> [Azure DevOps](https://example.com)";
    const imageDoc = "> ![Diagram](https://example.com/image.png)";
    const imageResult = runCommand("image", linkDoc, 0, linkDoc.length);

    expect(imageResult.doc).toBe("> ![Azure DevOps](https://example.com)");
    expect(imageResult.doc.slice(imageResult.selection.from, imageResult.selection.to)).toBe(
      "https://example.com",
    );

    const linkResult = runCommand("link", imageDoc, 0, imageDoc.length);

    expect(linkResult.doc).toBe("> [Diagram](https://example.com/image.png)");
    expect(linkResult.doc.slice(linkResult.selection.from, linkResult.selection.to)).toBe(
      "https://example.com/image.png",
    );
  });

  it("turns selected text into a markdown link when pasting a url", () => {
    expect(
      pasteUrlOverSelection("Open Azure DevOps", 5, 17, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "Open [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
  });

  it("preserves quote context when pasting a url over a fully selected quoted line", () => {
    expect(
      pasteUrlOverSelection("> Azure DevOps", 0, 14, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "> [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
  });

  it("preserves indentation when pasting a url over a fully selected indented line", () => {
    expect(
      pasteUrlOverSelection("  Azure DevOps", 0, 14, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "  [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
  });

  it("preserves list markers when pasting a url over a fully selected list line", () => {
    expect(
      pasteUrlOverSelection("- Azure DevOps", 0, 14, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "- [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
    expect(
      pasteUrlOverSelection("- [ ] Azure DevOps", 0, 18, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "- [ ] [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
  });

  it("escapes and normalizes selected text when pasting a url as a link", () => {
    expect(
      pasteUrlOverSelection("Build [API]\ndocs", 0, 16, "https://example.com/docs"),
    ).toMatchObject({
      doc: "[Build \\[API\\] docs](https://example.com/docs)",
      handled: true,
    });
  });

  it("wraps pasted link destinations that need markdown escaping", () => {
    expect(
      pasteUrlOverSelection("Spec", 0, 4, "https://example.com/docs/(draft)"),
    ).toMatchObject({
      doc: "[Spec](<https://example.com/docs/(draft)>)",
      handled: true,
    });
    expect(
      pasteUrlOverSelection("Spec", 0, 4, "https://example.com/<draft>"),
    ).toMatchObject({
      doc: "[Spec](<https://example.com/\\<draft\\>>)",
      handled: true,
    });
  });

  it("replaces selected urls plainly when pasting another url", () => {
    expect(
      pasteUrlOverSelection(
        "See https://old.example.com",
        4,
        27,
        "https://new.example.com",
      ),
    ).toMatchObject({
      doc: "See https://new.example.com",
      handled: true,
    });
    expect(
      pasteUrlOverSelection(
        "  https://old.example.com",
        0,
        25,
        "https://new.example.com",
      ),
    ).toMatchObject({
      doc: "  https://new.example.com",
      handled: true,
    });
    expect(
      pasteUrlOverSelection(
        "- https://old.example.com",
        0,
        25,
        "https://new.example.com",
      ),
    ).toMatchObject({
      doc: "- https://new.example.com",
      handled: true,
    });
  });

  it("updates an existing markdown link when pasting a url inside it", () => {
    const doc = "[Azure DevOps](https://old.example.com)";

    expect(
      pasteUrlOverSelection(doc, 1, 13, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "[Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
    expect(
      pasteUrlOverSelection(doc, 15, 38, "https://dev.azure.com/new"),
    ).toMatchObject({
      doc: "[Azure DevOps](https://dev.azure.com/new)",
      handled: true,
    });
  });

  it("updates an existing markdown link when pasting a url at the cursor", () => {
    const doc = "[Azure DevOps](https://old.example.com)";

    expect(
      pasteUrlOverSelection(doc, 4, 4, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "[Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
    expect(
      pasteUrlOverSelection(doc, 22, 22, "https://dev.azure.com/new"),
    ).toMatchObject({
      doc: "[Azure DevOps](https://dev.azure.com/new)",
      handled: true,
    });
  });

  it("updates an existing quoted markdown link when pasting over the selected line", () => {
    const doc = "> [Azure DevOps](https://old.example.com)";

    expect(
      pasteUrlOverSelection(doc, 0, doc.length, "https://dev.azure.com/org"),
    ).toMatchObject({
      doc: "> [Azure DevOps](https://dev.azure.com/org)",
      handled: true,
    });
  });

  it("updates an existing markdown image when pasting a url inside it", () => {
    const doc = "![Diagram](https://old.example.com/image.png)";

    expect(
      pasteUrlOverSelection(doc, 2, 9, "https://example.com/new.png"),
    ).toMatchObject({
      doc: "![Diagram](https://example.com/new.png)",
      handled: true,
    });
  });

  it("updates an existing markdown image when pasting a url at the cursor", () => {
    const doc = "![Diagram](https://old.example.com/image.png)";

    expect(
      pasteUrlOverSelection(doc, 4, 4, "https://example.com/new.png"),
    ).toMatchObject({
      doc: "![Diagram](https://example.com/new.png)",
      handled: true,
    });
  });

  it("updates an existing quoted markdown image when pasting over the selected line", () => {
    const doc = "> ![Diagram](https://old.example.com/image.png)";

    expect(
      pasteUrlOverSelection(doc, 0, doc.length, "https://example.com/new.png"),
    ).toMatchObject({
      doc: "> ![Diagram](https://example.com/new.png)",
      handled: true,
    });
  });

  it("formats existing markdown link destinations when pasting urls that need escaping", () => {
    const linkDoc = "[Spec](https://old.example.com)";
    const imageDoc = "![Diagram](https://old.example.com/image.png)";

    expect(
      pasteUrlOverSelection(linkDoc, 1, 5, "https://example.com/docs/(draft)"),
    ).toMatchObject({
      doc: "[Spec](<https://example.com/docs/(draft)>)",
      handled: true,
    });
    expect(
      pasteUrlOverSelection(imageDoc, 2, 9, "https://example.com/<draft>.png"),
    ).toMatchObject({
      doc: "![Diagram](<https://example.com/\\<draft\\>.png>)",
      handled: true,
    });
  });

  it("updates angle-wrapped destinations even when they contain unmatched parentheses", () => {
    const doc = "[Spec](<https://example.com/docs/(draft>)";

    expect(
      pasteUrlOverSelection(doc, 1, 5, "https://example.com/replacement"),
    ).toMatchObject({
      doc: "[Spec](https://example.com/replacement)",
      handled: true,
    });
  });

  it("lets normal paste handle non-url and empty-selection paste", () => {
    expect(pasteUrlOverSelection("Azure DevOps", 0, 12, "not a url")).toMatchObject({
      doc: "Azure DevOps",
      handled: false,
    });
    expect(pasteUrlOverSelection("Azure DevOps", 5, 5, "https://example.com")).toMatchObject({
      doc: "Azure DevOps",
      handled: false,
    });
  });

  it("does not turn pasted urls into links inside fenced code or read-only state", () => {
    const codeDoc = "```\nAzure DevOps\n```";

    expect(
      pasteUrlOverSelection(
        codeDoc,
        codeDoc.indexOf("Azure"),
        codeDoc.indexOf("Azure") + 12,
        "https://example.com",
      ),
    ).toMatchObject({
      doc: codeDoc,
      handled: false,
    });
    expect(
      pasteUrlOverSelection("Azure DevOps", 0, 12, "https://example.com", {
        readOnly: true,
      }),
    ).toMatchObject({
      doc: "Azure DevOps",
      handled: false,
    });
  });

  it("converts pasted rich text html to markdown", () => {
    expect(
      pasteHtmlOverSelection(
        "Before\n\nAfter",
        8,
        8,
        "<h2>Plan</h2><p>Ship <strong>editor</strong> with <a href=\"https://example.com\">docs</a>.</p>",
      ),
    ).toMatchObject({
      doc: "Before\n\n## Plan\n\nShip **editor** with [docs](https://example.com).\n\nAfter",
      handled: true,
    });
  });

  it("removes whitespace-only lines from pasted empty rich text blocks", () => {
    expect(
      pasteHtmlOverSelection(
        "",
        0,
        0,
        "<div>First line</div><div><br></div><div>Second line</div>",
      ),
    ).toMatchObject({
      doc: "First line\n\nSecond line",
      handled: true,
    });
  });

  it("converts pasted rich task lists and tables to markdown", () => {
    expect(
      pasteHtmlOverSelection(
        "",
        0,
        0,
        "<ul><li><input type=\"checkbox\" checked>Done</li><li><input type=\"checkbox\">Next</li></ul><table><tr><th>Name</th><th>Status</th></tr><tr><td>Editor</td><td>Ready</td></tr></table>",
      ),
    ).toMatchObject({
      doc: "- [x] Done\n- [ ] Next\n\n| Name | Status |\n| --- | --- |\n| Editor | Ready |",
      handled: true,
    });
  });

  it("preserves inline markdown inside pasted rich table cells", () => {
    expect(
      pasteHtmlOverSelection(
        "",
        0,
        0,
        [
          "<table>",
          "<tr><th>Name</th><th>Reference</th></tr>",
          '<tr><td><strong>API</strong></td><td><a href="https://example.com">Docs</a></td></tr>',
          "<tr><td>A | B</td><td><em>Ready</em></td></tr>",
          "</table>",
        ].join(""),
      ),
    ).toMatchObject({
      doc: [
        "| Name | Reference |",
        "| --- | --- |",
        "| **API** | [Docs](https://example.com) |",
        "| A \\| B | _Ready_ |",
      ].join("\n"),
      handled: true,
    });
  });

  it("preserves nested pasted rich task lists", () => {
    expect(
      pasteHtmlOverSelection(
        "",
        0,
        0,
        [
          "<ul>",
          '<li><input type="checkbox" checked> Parent</li>',
          "<ul>",
          '<li><input type="checkbox"> Child</li>',
          "<ul>",
          '<li><input type="checkbox"> Grandchild</li>',
          "</ul>",
          "</ul>",
          "</ul>",
        ].join(""),
      ),
    ).toMatchObject({
      doc: [
        "- [x] Parent",
        "    - [ ] Child",
        "        - [ ] Grandchild",
      ].join("\n"),
      handled: true,
    });
  });

  it("preserves structural line markers when pasting html over selected lines", () => {
    expect(
      pasteHtmlOverSelection(
        "- [ ] Old task",
        0,
        14,
        "<strong>New task</strong>",
      ),
    ).toMatchObject({
      doc: "- [ ] **New task**",
      handled: true,
    });
    expect(
      pasteHtmlOverSelection(
        "> Old quote",
        0,
        11,
        "<p><em>New quote</em></p>",
      ),
    ).toMatchObject({
      doc: "> _New quote_",
      handled: true,
    });
  });

  it("replaces selected structural lines when pasted html is block markdown", () => {
    expect(
      pasteHtmlOverSelection(
        "- [ ] Old task",
        0,
        14,
        "<ul><li><input type=\"checkbox\" checked>Done</li><li><input type=\"checkbox\">Next</li></ul>",
      ),
    ).toMatchObject({
      doc: "- [x] Done\n- [ ] Next",
      handled: true,
    });
    expect(
      pasteHtmlOverSelection(
        "- Old item",
        0,
        10,
        "<h2>New section</h2>",
      ),
    ).toMatchObject({
      doc: "## New section",
      handled: true,
    });
  });

  it("preserves structural line markers when pasting plain text over selected lines", () => {
    expect(
      pasteTextOverSelection("- [ ] Old task", 0, 14, "New task"),
    ).toMatchObject({
      doc: "- [ ] New task",
      handled: true,
    });
    expect(
      pasteTextOverSelection("> Old quote", 0, 11, "New quote"),
    ).toMatchObject({
      doc: "> New quote",
      handled: true,
    });
  });

  it("preserves structural line markers when pasting multiline plain text", () => {
    expect(
      pasteTextOverSelection("- [ ] Old task", 0, 14, "First\nSecond"),
    ).toMatchObject({
      doc: "- [ ] First\n- [ ] Second",
      handled: true,
    });
    expect(
      pasteTextOverSelection("> Old quote", 0, 11, "First\n\nSecond"),
    ).toMatchObject({
      doc: "> First\n\n> Second",
      handled: true,
    });
    expect(
      pasteTextOverSelection("3. Old item", 0, 11, "First\nSecond"),
    ).toMatchObject({
      doc: "3. First\n4. Second",
      handled: true,
    });
  });

  it("replaces selected structural lines when pasted plain text is markdown", () => {
    expect(
      pasteTextOverSelection("- [ ] Old task", 0, 14, "- [x] New task"),
    ).toMatchObject({
      doc: "- [x] New task",
      handled: true,
    });
    expect(
      pasteTextOverSelection("- Old item", 0, 10, "## New section"),
    ).toMatchObject({
      doc: "## New section",
      handled: true,
    });
    expect(
      pasteTextOverSelection("> Old quote", 0, 11, "> New quote"),
    ).toMatchObject({
      doc: "> New quote",
      handled: true,
    });
  });

  it("lets normal paste handle non-structural plain text selections", () => {
    expect(
      pasteTextOverSelection("Old task", 0, 8, "New task"),
    ).toMatchObject({
      doc: "Old task",
      handled: false,
    });
  });

  it("does not convert pasted html inside fenced code or read-only state", () => {
    const codeDoc = "```\nreplace me\n```";

    expect(
      pasteHtmlOverSelection(
        codeDoc,
        codeDoc.indexOf("replace"),
        codeDoc.indexOf("replace") + 10,
        "<strong>HTML</strong>",
      ),
    ).toMatchObject({
      doc: codeDoc,
      handled: false,
    });
    expect(
      pasteHtmlOverSelection("", 0, 0, "<strong>HTML</strong>", {
        readOnly: true,
      }),
    ).toMatchObject({
      doc: "",
      handled: false,
    });
  });

  it("selects the existing url when linking inside an escaped link label", () => {
    const doc = "[Build \\[API\\] docs](https://example.com)";
    const result = runCommand("link", doc, 10);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com",
    );
  });

  it("selects the full existing url when a link destination contains parentheses", () => {
    const doc = "[Spec](https://example.com/docs/(draft)/api)";
    const result = runCommand("link", doc, 2);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com/docs/(draft)/api",
    );
  });

  it("selects angle-wrapped link destinations without treating parentheses as syntax", () => {
    const doc = "[Spec](<https://example.com/docs/(draft>)";
    const result = runCommand("link", doc, 2);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "<https://example.com/docs/(draft>",
    );
  });

  it("inserts images with useful placeholder selection", () => {
    const emptyResult = runCommand("image", "", 0);

    expect(emptyResult.doc).toBe("![image description](https://)");
    expect(emptyResult.doc.slice(emptyResult.selection.from, emptyResult.selection.to)).toBe(
      "image description",
    );

    const selectedResult = runCommand("image", "Architecture diagram", 0, 20);

    expect(selectedResult.doc).toBe("![Architecture diagram](https://)");
    expect(
      selectedResult.doc.slice(
        selectedResult.selection.from,
        selectedResult.selection.to,
      ),
    ).toBe("https://");
  });

  it("selects the existing url when editing an existing image", () => {
    const doc = "![Diagram](https://example.com/image.png)";
    const result = runCommand("image", doc, 4);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com/image.png",
    );
  });

  it("selects the existing url when editing an image with an escaped label", () => {
    const doc = "![Path \\[draft\\]](https://example.com/image.png)";
    const result = runCommand("image", doc, 9);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com/image.png",
    );
  });

  it("selects the full existing image url when the destination contains parentheses", () => {
    const doc = "![Diagram](https://example.com/assets/(draft)/image.png)";
    const result = runCommand("image", doc, 4);

    expect(result.doc).toBe(doc);
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "https://example.com/assets/(draft)/image.png",
    );
  });

  it("inserts fenced code blocks with the code placeholder selected", () => {
    const result = runCommand("codeBlock", "Before", 6);

    expect(result.doc).toBe("Before\n\n```\ncode\n```");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "code",
    );
  });

  it("preserves quote context when inserting fenced code blocks", () => {
    const result = runCommand("codeBlock", "> Quote", 7);

    expect(result.doc).toBe("> Quote\n\n> ```\n> code\n> ```");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "code",
    );
  });

  it("wraps selected content in fenced code blocks", () => {
    const result = runCommand("codeBlock", "Before\nconsole.log(1);\nAfter", 7, 22);

    expect(result.doc).toBe("Before\n```\nconsole.log(1);\n```\nAfter");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "console.log(1);",
    );
  });

  it("wraps selected quoted content in quoted fenced code blocks", () => {
    const doc = "> console.log(1);";
    const result = runCommand("codeBlock", doc, 2, doc.length);

    expect(result.doc).toBe("> ```\n> console.log(1);\n> ```");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "console.log(1);",
    );
  });

  it("does not double-prefix quoted content when wrapping full quoted lines", () => {
    const doc = "> console.log(1);";
    const result = runCommand("codeBlock", doc, 0, doc.length);

    expect(result.doc).toBe("> ```\n> console.log(1);\n> ```");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "console.log(1);",
    );
  });

  it("wraps selected multiline quoted content in one quoted fenced code block", () => {
    const doc = "> const value = true;\n> console.log(value);";
    const result = runCommand("codeBlock", doc, 2, doc.length);

    expect(result.doc).toBe([
      "> ```",
      "> const value = true;",
      "> console.log(value);",
      "> ```",
    ].join("\n"));
  });

  it("does not pull mixed quote-context selections into one quote", () => {
    const doc = "> quoted\nplain";
    const result = runCommand("codeBlock", doc, 2, doc.length);

    expect(result.doc).toBe([
      "```",
      "> quoted",
      "plain",
      "```",
    ].join("\n"));
  });

  it("uses a longer code fence when selected code contains backtick fences", () => {
    const code = "const doc = ` ``` `;";
    const result = runCommand("codeBlock", code, 0, code.length);

    expect(result.doc).toBe("````\nconst doc = ` ``` `;\n````");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(code);
  });

  it("toggles existing fenced code blocks back to plain content", () => {
    const result = runCommand("codeBlock", "Before\n```ts\nconst ok = true;\n```\nAfter", 18);

    expect(result.doc).toBe("Before\nconst ok = true;\nAfter");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "const ok = true;",
    );
  });

  it("toggles tilde fenced code blocks back to plain content", () => {
    const result = runCommand("codeBlock", "~~~\ncode\n~~~", 5);

    expect(result.doc).toBe("code");
    expect(result.doc.slice(result.selection.from, result.selection.to)).toBe(
      "code",
    );
  });

  it("detects active block formatting for the current selection", () => {
    expect(activeCommands("## Heading", 3).has("heading2")).toBe(true);
    expect(activeCommands("> Quote", 2).has("quote")).toBe(true);
    expect(activeCommands("- List item", 2).has("bulletList")).toBe(true);
    expect(activeCommands("> - List item", 4).has("bulletList")).toBe(true);
    expect(activeCommands("1. List item", 3).has("orderedList")).toBe(true);
    expect(activeCommands("> 1. List item", 5).has("orderedList")).toBe(true);
    expect(activeCommands("- [ ] Task", 6).has("taskList")).toBe(true);
    expect(activeCommands("> - [ ] Task", 8).has("taskList")).toBe(true);
    expect(activeCommands("1. [ ] Task", 6).has("taskList")).toBe(true);
    expect(activeCommands("> 1. [ ] Task", 8).has("taskList")).toBe(true);
    expect(activeCommands("1. [ ] Task", 6).has("orderedList")).toBe(false);
    expect(activeCommands("- [ ]", 5).has("taskList")).toBe(true);
    expect(activeCommands("1. [ ]", 6).has("taskList")).toBe(true);
    expect(activeCommands("---", 1).has("horizontalRule")).toBe(true);
    expect(activeCommands("> ---", 3).has("horizontalRule")).toBe(true);
    expect(activeCommands("Plain paragraph", 0).has("paragraph")).toBe(true);
  });

  it("detects active inline formatting around the cursor", () => {
    expect(activeCommands("**bold**", 3).has("bold")).toBe(true);
    expect(activeCommands("__bold__", 3).has("bold")).toBe(true);
    expect(activeCommands("_italic_", 3).has("italic")).toBe(true);
    expect(activeCommands("*italic*", 3).has("italic")).toBe(true);
    expect(activeCommands("~~deleted~~", 4).has("strikethrough")).toBe(true);
    expect(activeCommands("`code`", 2).has("inlineCode")).toBe(true);
    expect(activeCommands("``code ` sample``", 4).has("inlineCode")).toBe(true);
    expect(activeCommands("```````code```````", 8).has("inlineCode")).toBe(true);
    expect(activeCommands("> **bold**", 0, 10).has("bold")).toBe(true);
    expect(activeCommands("> _italic_", 0, 10).has("italic")).toBe(true);
    expect(activeCommands("> ~~deleted~~", 0, 13).has("strikethrough")).toBe(true);
    expect(activeCommands("> `code`", 0, 8).has("inlineCode")).toBe(true);
    expect(activeCommands("  **bold**", 0, 10).has("bold")).toBe(true);
    expect(activeCommands("  _italic_", 0, 10).has("italic")).toBe(true);
    expect(activeCommands("  ~~deleted~~", 0, 13).has("strikethrough")).toBe(true);
    expect(activeCommands("  `code`", 0, 8).has("inlineCode")).toBe(true);
    expect(activeCommands("- **bold**", 0, 10).has("bold")).toBe(true);
    expect(activeCommands("- [ ] `code`", 0, 12).has("inlineCode")).toBe(true);
  });

  it("does not detect intraword underscores as italic formatting", () => {
    expect(activeCommands("build_api_client", 7).has("italic")).toBe(false);
    expect(activeCommands("Use _api_ client", 6).has("italic")).toBe(true);
  });

  it("does not treat escaped inline delimiters as active formatting", () => {
    expect(activeCommands("\\_literal_", 4).has("italic")).toBe(false);
    expect(activeCommands("\\**literal**", 5).has("bold")).toBe(false);
    expect(activeCommands("\\~~literal~~", 5).has("strikethrough")).toBe(false);
    expect(activeCommands("\\`literal`", 4).has("inlineCode")).toBe(false);
  });

  it("does not treat strong delimiters as italic formatting", () => {
    expect(activeCommands("__bold__", 3).has("italic")).toBe(false);
    expect(activeCommands("**bold**", 3).has("italic")).toBe(false);
  });

  it("does not mark inline formatting active on empty delimiter runs", () => {
    expect(activeCommands("```", 1).has("inlineCode")).toBe(false);
    expect(activeCommands("__", 1).has("italic")).toBe(false);
    expect(activeCommands("****", 2).has("bold")).toBe(false);
    expect(activeCommands("~~~~", 2).has("strikethrough")).toBe(false);
  });

  it("does not mark selected empty delimiter runs as active inline formatting", () => {
    expect(activeCommands("__", 0, 2).has("italic")).toBe(false);
    expect(activeCommands("****", 0, 4).has("bold")).toBe(false);
    expect(activeCommands("~~~~", 0, 4).has("strikethrough")).toBe(false);
    expect(activeCommands("``", 0, 2).has("inlineCode")).toBe(false);
  });

  it("detects active structured blocks around the cursor", () => {
    const table = [
      "| Column | Value |",
      "| --- | --- |",
      "| Item | Detail |",
      "| Another | Row |",
    ].join("\n");

    expect(activeCommands("![Diagram](https://example.com/image.png)", 4).has("image"))
      .toBe(true);
    expect(activeCommands("[Azure DevOps](https://example.com)", 4).has("link"))
      .toBe(true);
    expect(
      activeCommands(
        "> [Azure DevOps](https://example.com)",
        0,
        "> [Azure DevOps](https://example.com)".length,
      ).has("link"),
    ).toBe(true);
    expect(
      activeCommands(
        "> ![Diagram](https://example.com/image.png)",
        0,
        "> ![Diagram](https://example.com/image.png)".length,
      ).has("image"),
    ).toBe(true);
    expect(
      activeCommands(
        "  [Azure DevOps](https://example.com)",
        0,
        "  [Azure DevOps](https://example.com)".length,
      ).has("link"),
    ).toBe(true);
    expect(
      activeCommands(
        "  ![Diagram](https://example.com/image.png)",
        0,
        "  ![Diagram](https://example.com/image.png)".length,
      ).has("image"),
    ).toBe(true);
    expect(activeCommands("```\ncode\n```", 5).has("codeBlock")).toBe(true);
    expect(activeCommands("```\ncode\n```", 9).has("codeBlock")).toBe(true);
    expect(activeCommands("~~~ts\ncode\n~~~", 8).has("codeBlock")).toBe(true);
    expect(activeCommands(table, 3).has("table")).toBe(true);
    expect(activeCommands(table, table.indexOf("Another")).has("table")).toBe(true);
    expect(
      activeCommands(table, table.indexOf("| --- | --- |") + 2).has("table"),
    ).toBe(true);
    expect(
      activeCommands(
        "> | Column | Value |\n> | --- | --- |\n> | Item | Detail |",
        41,
      ).has("table"),
    ).toBe(true);
  });

  it("does not mark links or images active at cursor boundaries", () => {
    const image = "![Diagram](https://example.com/image.png)";
    const link = "[Azure DevOps](https://example.com)";

    expect(activeCommands(image, 0).has("image")).toBe(false);
    expect(activeCommands(image, image.length).has("image")).toBe(false);
    expect(activeCommands(image, 4).has("image")).toBe(true);
    expect(activeCommands(link, 0).has("link")).toBe(false);
    expect(activeCommands(link, link.length).has("link")).toBe(false);
    expect(activeCommands(link, 4).has("link")).toBe(true);
    expect(activeCommands(image, 0, image.length).has("image")).toBe(true);
    expect(activeCommands(link, 0, link.length).has("link")).toBe(true);
  });

  it("does not treat fenced code content as active markdown formatting", () => {
    const commands = activeCommands("```\n**not bold**\n- not a list\n```", 8);

    expect(commands.has("codeBlock")).toBe(true);
    expect(commands.has("bold")).toBe(false);
    expect(commands.has("bulletList")).toBe(false);
    expect(commands.has("paragraph")).toBe(false);
  });

  it("does not treat quoted fenced code content as active markdown formatting", () => {
    const doc = "> ```\n> **not bold**\n> - not a list\n> ```";
    const commands = activeCommands(doc, doc.indexOf("not bold"));

    expect(commands.has("codeBlock")).toBe(true);
    expect(commands.has("bold")).toBe(false);
    expect(commands.has("bulletList")).toBe(false);
    expect(commands.has("quote")).toBe(false);
    expect(commands.has("paragraph")).toBe(false);
  });

  it("treats unclosed fenced code as code through the end of the document", () => {
    const commands = activeCommands("```\n**not bold**\n- not a list", 8);

    expect(commands.has("codeBlock")).toBe(true);
    expect(commands.has("bold")).toBe(false);
    expect(commands.has("bulletList")).toBe(false);
    expect(commands.has("paragraph")).toBe(false);
  });

  it("does not treat inline backtick runs as unclosed fenced code", () => {
    const commands = activeCommands("```````code```````", 8);

    expect(commands.has("codeBlock")).toBe(false);
    expect(commands.has("inlineCode")).toBe(true);
  });

  it("blocks non-code-block toolbar commands inside fenced code", () => {
    const doc = "```\ncode\n```";
    const linkResult = runViewCommand("link", doc, 5);

    expect(linkResult.doc).toBe(doc);
    expect(linkResult.handled).toBe(false);
    expect(linkResult.focus).toHaveBeenCalledOnce();

    const codeBlockResult = runViewCommand("codeBlock", doc, 5);

    expect(codeBlockResult.doc).toBe("code");
    expect(codeBlockResult.handled).toBe(true);
  });

  it("blocks non-code-block toolbar commands inside quoted fenced code", () => {
    const doc = "> ```\n> code\n> ```";
    const linkResult = runViewCommand("link", doc, doc.indexOf("code"));

    expect(linkResult.doc).toBe(doc);
    expect(linkResult.handled).toBe(false);

    const codeBlockResult = runViewCommand("codeBlock", doc, doc.indexOf("code"));

    expect(codeBlockResult.doc).toBe("> code");
    expect(codeBlockResult.handled).toBe(true);
  });

  it("blocks non-code-block toolbar commands inside unclosed fenced code", () => {
    const doc = "```\ncode";
    const linkResult = runViewCommand("link", doc, 5);

    expect(linkResult.doc).toBe(doc);
    expect(linkResult.handled).toBe(false);

    const codeBlockResult = runViewCommand("codeBlock", doc, 5);

    expect(codeBlockResult.doc).toBe("code");
    expect(codeBlockResult.handled).toBe(true);
  });

  it("continues markdown lists, tasks, and quotes on Enter", () => {
    expect(runKeyBinding("Enter", "- Item", 6)).toMatchObject({
      doc: "- Item\n- ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "1. Item", 7)).toMatchObject({
      doc: "1. Item\n2. ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "- [x] Done", 10)).toMatchObject({
      doc: "- [x] Done\n- [ ] ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "1. [ ] Done", 11)).toMatchObject({
      doc: "1. [ ] Done\n2. [ ] ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> Quote", 7)).toMatchObject({
      doc: "> Quote\n> ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> > Quote", 9)).toMatchObject({
      doc: "> > Quote\n> > ",
      handled: true,
    });
  });

  it("continues quoted markdown lists and tasks on Enter", () => {
    expect(runKeyBinding("Enter", "> - Item", 8)).toMatchObject({
      doc: "> - Item\n> - ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> 1. Item", 9)).toMatchObject({
      doc: "> 1. Item\n> 2. ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> - [ ] Done", 12)).toMatchObject({
      doc: "> - [ ] Done\n> - [ ] ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> 1. [ ] Done", 13)).toMatchObject({
      doc: "> 1. [ ] Done\n> 2. [ ] ",
      handled: true,
    });
  });

  it("lets default Enter handle cursor positions inside markdown markers", () => {
    expect(runKeyBinding("Enter", "- Item", 1)).toMatchObject({
      doc: "- Item",
      handled: false,
    });
    expect(runKeyBinding("Enter", "1. Item", 2)).toMatchObject({
      doc: "1. Item",
      handled: false,
    });
    expect(runKeyBinding("Enter", "- [x] Done", 3)).toMatchObject({
      doc: "- [x] Done",
      handled: false,
    });
    expect(runKeyBinding("Enter", "1. [ ] Done", 5)).toMatchObject({
      doc: "1. [ ] Done",
      handled: false,
    });
    expect(runKeyBinding("Enter", "> Quote", 1)).toMatchObject({
      doc: "> Quote",
      handled: false,
    });
  });

  it("renumbers following ordered list items when continuing an ordered list", () => {
    expect(runKeyBinding("Enter", "1. One\n2. Two\n3. Three", 6)).toMatchObject({
      doc: "1. One\n2. \n3. Two\n4. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Enter", "1. [ ] One\n2. [ ] Two", 10),
    ).toMatchObject({
      doc: "1. [ ] One\n2. [ ] \n3. [ ] Two",
      handled: true,
    });
  });

  it("keeps nested ordered list numbering scoped to the current indentation", () => {
    expect(
      runKeyBinding("Enter", "  1. Nested\n  2. Next\n1. Top", 11),
    ).toMatchObject({
      doc: "  1. Nested\n  2. \n  3. Next\n1. Top",
      handled: true,
    });
  });

  it("exits empty markdown list, task, and quote markers on Enter", () => {
    expect(runKeyBinding("Enter", "- ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "1. ", 3)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "- [ ] ", 6)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "- [ ]", 5)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "1. [ ]", 6)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> > ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
  });

  it("exits empty quoted markdown list and task markers on Enter", () => {
    expect(runKeyBinding("Enter", "> - ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> 1. ", 5)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> - [ ] ", 8)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Enter", "> 1. [ ]", 8)).toMatchObject({
      doc: "> ",
      handled: true,
    });
  });

  it("renumbers following ordered list items when exiting an empty ordered item", () => {
    expect(runKeyBinding("Enter", "1. One\n2. \n3. Three", 10)).toMatchObject({
      doc: "1. One\n\n2. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Enter", "1. [ ] One\n2. [ ] \n3. [ ] Three", 18),
    ).toMatchObject({
      doc: "1. [ ] One\n\n2. [ ] Three",
      handled: true,
    });
  });

  it("lets the default Enter behavior handle plain markdown text", () => {
    expect(runKeyBinding("Enter", "Plain text", 10)).toMatchObject({
      doc: "Plain text",
      handled: false,
    });
  });

  it("lets default Enter handle markdown-looking lines inside fenced code", () => {
    const doc = "```\n- code item\n> code quote\n```";

    expect(runKeyBinding("Enter", doc, doc.indexOf("- code item") + 11)).toMatchObject({
      doc,
      handled: false,
    });
    expect(runKeyBinding("Enter", doc, doc.indexOf("> code quote") + 12)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("lets default Enter handle markdown-looking lines inside quoted fenced code", () => {
    const doc = "> ```\n> - code item\n> code quote\n> ```";

    expect(runKeyBinding("Enter", doc, doc.indexOf("- code item") + 11))
      .toMatchObject({
        doc,
        handled: false,
      });
    expect(runKeyBinding("Enter", doc, doc.indexOf("> code quote") + 12))
      .toMatchObject({
        doc,
        handled: false,
      });
  });

  it("lets default Enter handle markdown-looking lines inside unclosed fenced code", () => {
    const doc = "```\n- code item";

    expect(runKeyBinding("Enter", doc, doc.indexOf("- code item") + 11)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("does not continue markdown markers in read-only editor state", () => {
    expect(runKeyBinding("Enter", "- Item", 6, 6, { readOnly: true })).toMatchObject({
      doc: "- Item",
      handled: false,
    });
  });

  it("removes empty inline formatting wrappers on Backspace", () => {
    expect(runKeyBinding("Backspace", "****", 2)).toMatchObject({
      doc: "",
      handled: true,
      selection: {
        from: 0,
        to: 0,
      },
    });
    expect(runKeyBinding("Backspace", "__", 1)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "~~~~", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "``", 1)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "- ****", 4)).toMatchObject({
      doc: "- ",
      handled: true,
      selection: {
        from: 2,
        to: 2,
      },
    });
  });

  it("removes empty inline formatting wrappers on Delete", () => {
    expect(runKeyBinding("Delete", "****", 2)).toMatchObject({
      doc: "",
      handled: true,
      selection: {
        from: 0,
        to: 0,
      },
    });
    expect(runKeyBinding("Delete", "__", 1)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "~~~~", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "``", 1)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "- ****", 4)).toMatchObject({
      doc: "- ",
      handled: true,
      selection: {
        from: 2,
        to: 2,
      },
    });
  });

  it("lets default Backspace handle non-empty inline formatting wrappers", () => {
    expect(runKeyBinding("Backspace", "**strong text**", 2)).toMatchObject({
      doc: "**strong text**",
      handled: false,
    });
    expect(runKeyBinding("Backspace", "`code`", 1)).toMatchObject({
      doc: "`code`",
      handled: false,
    });
  });

  it("lets default Delete handle non-empty inline formatting wrappers", () => {
    expect(runKeyBinding("Delete", "**strong text**", 2)).toMatchObject({
      doc: "**strong text**",
      handled: false,
    });
    expect(runKeyBinding("Delete", "`code`", 1)).toMatchObject({
      doc: "`code`",
      handled: false,
    });
  });

  it("lets default Backspace handle empty inline wrappers inside fenced code", () => {
    const asteriskDoc = "```\n****\n```";
    const tildeDoc = "```\n~~~~\n```";

    expect(
      runKeyBinding("Backspace", asteriskDoc, asteriskDoc.indexOf("****") + 2),
    ).toMatchObject({
      doc: asteriskDoc,
      handled: false,
    });
    expect(
      runKeyBinding("Backspace", tildeDoc, tildeDoc.indexOf("~~~~") + 2),
    ).toMatchObject({
      doc: tildeDoc,
      handled: false,
    });
  });

  it("lets default Delete handle empty inline wrappers inside fenced code", () => {
    const asteriskDoc = "```\n****\n```";
    const tildeDoc = "```\n~~~~\n```";

    expect(
      runKeyBinding("Delete", asteriskDoc, asteriskDoc.indexOf("****") + 2),
    ).toMatchObject({
      doc: asteriskDoc,
      handled: false,
    });
    expect(
      runKeyBinding("Delete", tildeDoc, tildeDoc.indexOf("~~~~") + 2),
    ).toMatchObject({
      doc: tildeDoc,
      handled: false,
    });
  });

  it("cleans up empty link and image labels on Backspace", () => {
    expect(runKeyBinding("Backspace", "[](https://example.com)", 1)).toMatchObject({
      doc: "https://example.com",
      handled: true,
    });
    expect(
      runKeyBinding("Backspace", "![](https://example.com/image.png)", 2),
    ).toMatchObject({
      doc: "https://example.com/image.png",
      handled: true,
    });
    expect(
      runKeyBinding("Backspace", "[](<https://example.com/docs/(draft)>)", 1),
    ).toMatchObject({
      doc: "https://example.com/docs/(draft)",
      handled: true,
    });
  });

  it("cleans up empty link and image destinations on Delete", () => {
    const linkDoc = "[Azure DevOps]()";
    const imageDoc = "![Diagram]()";
    const escapedLabelDoc = "[Build \\[API\\]]()";

    expect(runKeyBinding("Delete", linkDoc, linkDoc.indexOf("()") + 1)).toMatchObject({
      doc: "Azure DevOps",
      handled: true,
    });
    expect(runKeyBinding("Delete", imageDoc, imageDoc.indexOf("()") + 1)).toMatchObject({
      doc: "Diagram",
      handled: true,
    });
    expect(
      runKeyBinding("Delete", escapedLabelDoc, escapedLabelDoc.indexOf("()") + 1),
    ).toMatchObject({
      doc: "Build [API]",
      handled: true,
    });
  });

  it("lets default deletion handle non-empty link and image placeholders", () => {
    expect(runKeyBinding("Backspace", "[Azure DevOps](https://example.com)", 7))
      .toMatchObject({
        doc: "[Azure DevOps](https://example.com)",
        handled: false,
      });
    expect(runKeyBinding("Delete", "![Diagram](https://example.com/image.png)", 6))
      .toMatchObject({
        doc: "![Diagram](https://example.com/image.png)",
        handled: false,
      });
  });

  it("lets default deletion handle empty links inside fenced code", () => {
    const doc = "```\n[Draft]()\n```";

    expect(runKeyBinding("Delete", doc, doc.indexOf("()") + 1)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("removes empty fenced code blocks on Backspace and Delete", () => {
    const emptyFence = "```\n\n```";
    const emptyQuotedFence = "> ```\n> \n> ```";
    const trailingFence = "Before\n\n```\n\n```";
    const leadingFence = "```\n\n```\n\nAfter";
    const middleFence = "Before\n\n```\n\n```\n\nAfter";
    const beforeExistingLineFence = "Before\n\n```\n\n```\nAfter";
    const afterExistingLineFence = "Before\n```\n\n```\n\nAfter";
    const singleLineBreakFence = "Before\n```\n\n```\nAfter";

    expect(runKeyBinding("Backspace", emptyFence, 4)).toMatchObject({
      doc: "",
      handled: true,
      selection: {
        from: 0,
        to: 0,
      },
    });
    expect(runKeyBinding("Delete", emptyFence, 4)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", emptyQuotedFence, 7)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", trailingFence, trailingFence.indexOf("```") + 4))
      .toMatchObject({
        doc: "Before",
        handled: true,
      });
    expect(runKeyBinding("Delete", leadingFence, 4)).toMatchObject({
      doc: "After",
      handled: true,
    });
    expect(runKeyBinding("Delete", middleFence, middleFence.indexOf("```") + 4))
      .toMatchObject({
        doc: "Before\n\nAfter",
        handled: true,
      });
    expect(
      runKeyBinding(
        "Backspace",
        beforeExistingLineFence,
        beforeExistingLineFence.indexOf("```") + 4,
      ),
    ).toMatchObject({
      doc: "Before\n\nAfter",
      handled: true,
    });
    expect(
      runKeyBinding(
        "Delete",
        afterExistingLineFence,
        afterExistingLineFence.indexOf("```") + 4,
      ),
    ).toMatchObject({
      doc: "Before\n\nAfter",
      handled: true,
    });
    expect(
      runKeyBinding(
        "Backspace",
        singleLineBreakFence,
        singleLineBreakFence.indexOf("```") + 4,
      ),
    ).toMatchObject({
      doc: "Before\nAfter",
      handled: true,
    });
  });

  it("lets default deletion handle fenced code blocks with content", () => {
    const doc = "```\ncode\n```";

    expect(runKeyBinding("Backspace", doc, doc.indexOf("code") + 2)).toMatchObject({
      doc,
      handled: false,
    });
    expect(runKeyBinding("Delete", doc, doc.indexOf("code") + 2)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("removes empty markdown markers on Backspace", () => {
    expect(runKeyBinding("Backspace", "## ", 3)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "- ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "  - ", 4)).toMatchObject({
      doc: "  ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "1. ", 3)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "- [ ] ", 6)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> > ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
  });

  it("removes empty markdown markers on Delete", () => {
    expect(runKeyBinding("Delete", "## ", 3)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "- ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "  - ", 4)).toMatchObject({
      doc: "  ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "1. ", 3)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "- [ ] ", 6)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> ", 2)).toMatchObject({
      doc: "",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> > ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
  });

  it("removes empty quoted markdown list and task markers on Backspace", () => {
    expect(runKeyBinding("Backspace", "> ## ", 5)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> - ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> 1. ", 5)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> - [ ] ", 8)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> > - ", 6)).toMatchObject({
      doc: "> > ",
      handled: true,
    });
    expect(runKeyBinding("Backspace", "> > - [ ] ", 10)).toMatchObject({
      doc: "> > ",
      handled: true,
    });
  });

  it("removes empty quoted markdown list and task markers on Delete", () => {
    expect(runKeyBinding("Delete", "> ## ", 5)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> - ", 4)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> 1. ", 5)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> - [ ] ", 8)).toMatchObject({
      doc: "> ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> > - ", 6)).toMatchObject({
      doc: "> > ",
      handled: true,
    });
    expect(runKeyBinding("Delete", "> > - [ ] ", 10)).toMatchObject({
      doc: "> > ",
      handled: true,
    });
  });

  it("renumbers following ordered list items when Backspace removes an empty ordered marker", () => {
    expect(runKeyBinding("Backspace", "1. One\n2. \n3. Three", 10)).toMatchObject({
      doc: "1. One\n\n2. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Backspace", "1. [ ] One\n2. [ ] \n3. [ ] Three", 18),
    ).toMatchObject({
      doc: "1. [ ] One\n\n2. [ ] Three",
      handled: true,
    });
  });

  it("renumbers following ordered list items when Delete removes an empty ordered marker", () => {
    expect(runKeyBinding("Delete", "1. One\n2. \n3. Three", 10)).toMatchObject({
      doc: "1. One\n\n2. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Delete", "1. [ ] One\n2. [ ] \n3. [ ] Three", 18),
    ).toMatchObject({
      doc: "1. [ ] One\n\n2. [ ] Three",
      handled: true,
    });
  });

  it("does not remove empty markers in read-only editor state", () => {
    expect(runKeyBinding("Backspace", "- ", 2, 2, { readOnly: true })).toMatchObject({
      doc: "- ",
      handled: false,
    });
  });

  it("lets default Backspace handle empty markers inside fenced code", () => {
    const doc = "```\n- \n```";

    expect(runKeyBinding("Backspace", doc, doc.indexOf("- ") + 2)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("lets default Backspace handle empty markers inside quoted fenced code", () => {
    const doc = "> ```\n> - \n> ```";

    expect(runKeyBinding("Backspace", doc, doc.indexOf("- ") + 2)).toMatchObject({
      doc,
      handled: false,
    });
  });

  it("lets default Backspace handle markdown markers with content", () => {
    expect(runKeyBinding("Backspace", "- Item", 6)).toMatchObject({
      doc: "- Item",
      handled: false,
    });
  });

  it("indents markdown list and task lines on Tab", () => {
    expect(runKeyBinding("Tab", "- Item", 0)).toMatchObject({
      doc: "  - Item",
      handled: true,
    });
    expect(runKeyBinding("Tab", "1. Item", 0)).toMatchObject({
      doc: "  1. Item",
      handled: true,
    });
    expect(runKeyBinding("Tab", "- [ ] Task", 0)).toMatchObject({
      doc: "  - [ ] Task",
      handled: true,
    });
  });

  it("indents quoted markdown list and task lines inside the quote", () => {
    expect(runKeyBinding("Tab", "> - Item", 0)).toMatchObject({
      doc: ">   - Item",
      handled: true,
    });
    expect(runKeyBinding("Tab", "> - [ ] Task", 0)).toMatchObject({
      doc: ">   - [ ] Task",
      handled: true,
    });
  });

  it("renumbers ordered lists when indenting ordered items", () => {
    expect(runKeyBinding("Tab", "1. One\n2. Two\n3. Three", 7)).toMatchObject({
      doc: "1. One\n  1. Two\n2. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Tab", "1. [ ] One\n2. [ ] Two\n3. [ ] Three", 11),
    ).toMatchObject({
      doc: "1. [ ] One\n  1. [ ] Two\n2. [ ] Three",
      handled: true,
    });
  });

  it("renumbers quoted ordered lists when indenting ordered items", () => {
    expect(runKeyBinding("Tab", "> 1. One\n> 2. Two\n> 3. Three", 9)).toMatchObject({
      doc: "> 1. One\n>   1. Two\n> 2. Three",
      handled: true,
    });
  });

  it("renumbers selected ordered list blocks when indenting multiple ordered items", () => {
    expect(runKeyBinding("Tab", "1. One\n2. Two\n3. Three\n4. Four", 7, 23)).toMatchObject({
      doc: "1. One\n  1. Two\n  2. Three\n2. Four",
      handled: true,
    });
  });

  it("indents selected markdown list lines without pulling in the next line", () => {
    expect(runKeyBinding("Tab", "- One\n- Two", 0, 11)).toMatchObject({
      doc: "  - One\n  - Two",
      handled: true,
    });
    expect(runKeyBinding("Tab", "- One\n- Two\nNext", 0, 6)).toMatchObject({
      doc: "  - One\n- Two\nNext",
      handled: true,
    });
  });

  it("outdents markdown list and task lines on Shift-Tab", () => {
    expect(runKeyBinding("Shift-Tab", "  - Item", 0)).toMatchObject({
      doc: "- Item",
      handled: true,
    });
    expect(runKeyBinding("Shift-Tab", "  1. Item", 0)).toMatchObject({
      doc: "1. Item",
      handled: true,
    });
    expect(runKeyBinding("Shift-Tab", "  - [ ] Task", 0)).toMatchObject({
      doc: "- [ ] Task",
      handled: true,
    });
  });

  it("outdents quoted markdown list and task lines without removing the quote", () => {
    expect(runKeyBinding("Shift-Tab", ">   - Item", 0)).toMatchObject({
      doc: "> - Item",
      handled: true,
    });
    expect(runKeyBinding("Shift-Tab", ">   - [ ] Task", 0)).toMatchObject({
      doc: "> - [ ] Task",
      handled: true,
    });
    expect(runKeyBinding("Shift-Tab", "> - Item", 0)).toMatchObject({
      doc: "> - Item",
      handled: true,
    });
  });

  it("renumbers ordered lists when outdenting ordered items", () => {
    expect(runKeyBinding("Shift-Tab", "1. One\n  1. Two\n2. Three", 7)).toMatchObject({
      doc: "1. One\n2. Two\n3. Three",
      handled: true,
    });
    expect(
      runKeyBinding("Shift-Tab", "1. [ ] One\n  1. [ ] Two\n2. [ ] Three", 11),
    ).toMatchObject({
      doc: "1. [ ] One\n2. [ ] Two\n3. [ ] Three",
      handled: true,
    });
  });

  it("renumbers quoted ordered lists when outdenting ordered items", () => {
    expect(runKeyBinding("Shift-Tab", "> 1. One\n>   1. Two\n> 2. Three", 9))
      .toMatchObject({
        doc: "> 1. One\n> 2. Two\n> 3. Three",
        handled: true,
      });
    expect(runKeyBinding("Shift-Tab", "> 1. One", 0)).toMatchObject({
      doc: "> 1. One",
      handled: true,
    });
  });

  it("renumbers selected ordered list blocks when outdenting multiple ordered items", () => {
    expect(
      runKeyBinding("Shift-Tab", "1. One\n  1. Two\n  2. Three\n2. Four", 7, 27),
    ).toMatchObject({
      doc: "1. One\n2. Two\n3. Three\n4. Four",
      handled: true,
    });
  });

  it("does not indent or outdent markdown lists in read-only editor state", () => {
    expect(runKeyBinding("Tab", "- Item", 0, 0, { readOnly: true })).toMatchObject({
      doc: "- Item",
      handled: false,
    });
    expect(
      runKeyBinding("Shift-Tab", "  - Item", 0, 0, { readOnly: true }),
    ).toMatchObject({
      doc: "  - Item",
      handled: false,
    });
  });

  it("wires Mod+K to the link command", () => {
    expect(runKeyBinding("Mod-k", "Link text", 0, 9)).toMatchObject({
      doc: "[Link text](https://)",
      handled: true,
    });
  });

  it("does not link markdown-looking text inside fenced code with Mod+K", () => {
    const doc = "```\nlink text\n```";

    expect(runKeyBinding("Mod-k", doc, 4, 13)).toMatchObject({
      doc,
      handled: false,
    });
  });
});
