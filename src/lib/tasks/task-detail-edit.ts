import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";
import TurndownService from "turndown";

export type TaskDetailEditableAssignee = {
  avatarUrl: string | null;
  label: string;
  value: string | null;
};

export type TaskDetailEditableValues = {
  areaPath: string;
  assignee: TaskDetailEditableAssignee;
  description: string;
  iterationPath: string;
  priority: string;
  title: string;
};

export type TaskDetailEditableChanges = Partial<{
  areaPath: string;
  assignee: string | null;
  description: string;
  iterationPath: string;
  priority: string;
  title: string;
}>;

function normalizeEditableString(value: string) {
  return value.trim();
}

function normalizeEditableMarkup(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function unescapeMarkdownLinkDestination(value: string) {
  return value
    .replace(/^<([\s\S]*)>$/, "$1")
    .replace(/\\([<>])/g, "$1");
}

function markdownLinkDestinationForAzureDevOps(value: string) {
  const shouldWrap = /[()<>]/.test(value);

  if (!shouldWrap) {
    return value;
  }

  return `<${value.replace(/[<>]/g, (character) => `\\${character}`)}>`;
}

function decodeAzureDevOpsMentionId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unwrapAzureDevOpsAssetProxySource(value: string) {
  try {
    const url = new URL(unescapeMarkdownLinkDestination(value), "http://local");

    if (url.origin !== "http://local" || url.pathname !== "/api/azure-devops/asset") {
      return null;
    }

    return url.searchParams.get("src");
  } catch {
    return null;
  }
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

function findMarkdownLinkDestinationEnd(value: string, start: number) {
  if (value[start] === "<" && !isEscaped(value, start)) {
    const closingAngle = findUnescapedCharacter(value, start + 1, ">");

    return closingAngle !== -1 ? closingAngle + 1 : -1;
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

function transformMarkdownLinks(
  value: string,
  transform: (link: {
    destination: string;
    from: number;
    label: string;
    marker: "" | "!";
    suffix: string;
    to: number;
  }) => string | null,
) {
  let result = "";
  let position = 0;

  while (position < value.length) {
    const bracketStart = value.indexOf("[", position);

    if (bracketStart === -1) {
      result += value.slice(position);
      break;
    }

    if (isEscaped(value, bracketStart)) {
      result += value.slice(position, bracketStart + 1);
      position = bracketStart + 1;
      continue;
    }

    const marker =
      bracketStart > 0 &&
        value[bracketStart - 1] === "!" &&
        !isEscaped(value, bracketStart - 1)
        ? "!"
        : "";
    const linkStart = marker ? bracketStart - 1 : bracketStart;
    const labelEnd = findUnescapedCharacter(value, bracketStart + 1, "]");

    if (labelEnd === -1 || value[labelEnd + 1] !== "(") {
      result += value.slice(position, bracketStart + 1);
      position = bracketStart + 1;
      continue;
    }

    const destinationStart = labelEnd + 2;
    const destinationEnd = findMarkdownLinkDestinationEnd(value, destinationStart);

    if (destinationEnd === -1) {
      result += value.slice(position, bracketStart + 1);
      position = bracketStart + 1;
      continue;
    }

    const closeParen = value.indexOf(")", destinationEnd);

    if (closeParen === -1) {
      result += value.slice(position, bracketStart + 1);
      position = bracketStart + 1;
      continue;
    }

    const replacement = transform({
      destination: value.slice(destinationStart, destinationEnd),
      from: linkStart,
      label: value.slice(bracketStart + 1, labelEnd),
      marker,
      suffix: value.slice(destinationEnd, closeParen),
      to: closeParen + 1,
    });

    result += value.slice(position, linkStart);
    result += replacement ?? value.slice(linkStart, closeParen + 1);
    position = closeParen + 1;
  }

  return result;
}

function splitMarkdownLinkDestination(
  destination: string,
  suffix: string,
) {
  if (destination.startsWith("<")) {
    return {
      destination,
      suffix,
    };
  }

  const match = destination.match(/^(\S+)([\s\S]*)$/);

  return {
    destination: match?.[1] ?? destination,
    suffix: `${match?.[2] ?? ""}${suffix}`,
  };
}

function isCheckboxInput(node: Node): node is Element {
  return (
    node.nodeType === 1 &&
    node.nodeName === "INPUT" &&
    (node as Element).getAttribute("type")?.toLowerCase() === "checkbox"
  );
}

function hasAzureDevOpsMention(node: Node): node is Element {
  return (
    node.nodeType === 1 &&
    typeof (node as Element).getAttribute("data-vss-mention") === "string"
  );
}

function isListElement(element: Element) {
  return element.tagName === "UL" || element.tagName === "OL";
}

function normalizeOrphanNestedListElement(list: Element) {
  let previousListItem: Element | null = null;

  for (const child of Array.from(list.children)) {
    if (child.tagName === "LI") {
      previousListItem = child;

      for (const nestedList of Array.from(child.children).filter(isListElement)) {
        normalizeOrphanNestedListElement(nestedList);
      }

      continue;
    }

    if (isListElement(child)) {
      normalizeOrphanNestedListElement(child);

      if (previousListItem) {
        previousListItem.appendChild(child);
      }

      continue;
    }

    previousListItem = null;
  }
}

function normalizeOrphanNestedListMarkup(value: string) {
  const orphanNestedListPattern =
    /<\/li>(\s*)((?:<(?:ul|ol)\b[\s\S]*?<\/(?:ul|ol)>\s*)+)/gi;
  let normalizedValue = value;

  for (let index = 0; index < 10; index += 1) {
    const nextValue = normalizedValue.replace(
      orphanNestedListPattern,
      "$1$2</li>",
    );

    if (nextValue === normalizedValue) {
      return normalizedValue;
    }

    normalizedValue = nextValue;
  }

  return normalizedValue;
}

function normalizeOrphanNestedLists(value: string) {
  if (typeof document === "undefined") {
    return normalizeOrphanNestedListMarkup(value);
  }

  const template = document.createElement("template");
  template.innerHTML = normalizeOrphanNestedListMarkup(value);

  for (const list of Array.from(template.content.children).filter(isListElement)) {
    normalizeOrphanNestedListElement(list);
  }

  for (const list of Array.from(template.content.querySelectorAll("ul, ol"))) {
    normalizeOrphanNestedListElement(list);
  }

  return template.innerHTML;
}

const htmlToMarkdownService = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  headingStyle: "atx",
  linkStyle: "inlined",
  strongDelimiter: "**",
});

htmlToMarkdownService.addRule("azureDevOpsMention", {
  filter: hasAzureDevOpsMention,
  replacement: (content, node) => {
    const mentionValue = node.getAttribute("data-vss-mention") ?? "";
    const mentionId = mentionValue.split(",").at(-1)?.trim().toLowerCase();
    const mentionLabel = (node.textContent ?? content).replace(/\s+/g, " ").trim();

    if (!mentionId || !mentionLabel) {
      return mentionLabel;
    }

    return `[${escapeMarkdownLinkText(mentionLabel)}](./ado-mention/${encodeURIComponent(mentionId)})`;
  },
});

htmlToMarkdownService.addRule("strikethrough", {
  filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
  replacement: (content) => content.trim() ? `~~${content}~~` : "",
});

htmlToMarkdownService.addRule("taskCheckbox", {
  filter: isCheckboxInput,
  replacement: (_content, node) => node.hasAttribute("checked") ? "[x]" : "[ ]",
});

function markdownTableCellContent(cell: Element) {
  const content = cell.innerHTML.trim()
    ? htmlToMarkdownService.turndown(cell.innerHTML)
    : (cell.textContent ?? "");

  return escapeMarkdownTableCell(content);
}

htmlToMarkdownService.addRule("table", {
  filter: "table",
  replacement: (_content, node) => {
    const rows = Array.from(node.querySelectorAll("tr"))
      .map((row) => {
        const cells = Array.from(row.children).filter(
          (cell) => cell.tagName === "TH" || cell.tagName === "TD",
        );

        return cells.map(markdownTableCellContent);
      })
      .filter((row) => row.length > 0);

    if (rows.length === 0) {
      return "";
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => [
      ...row,
      ...Array.from({ length: columnCount - row.length }, () => ""),
    ]);
    const lines = [
      `| ${normalizedRows[0]?.join(" | ") ?? ""} |`,
      `| ${Array.from({ length: columnCount }, () => "---").join(" | ")} |`,
      ...normalizedRows.slice(1).map((row) => `| ${row.join(" | ")} |`),
    ];

    return `\n\n${lines.join("\n")}\n\n`;
  },
});

export function convertHtmlToEditableMarkdown(value: string) {
  return normalizeEditableMarkup(
    htmlToMarkdownService.turndown(normalizeOrphanNestedLists(value)),
  )
    .replace(/^[\t ]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(\s*(?:[-+*]|\d+\.)) {2,}/gm, "$1 ")
    .replace(/^(\s*(?:[-+*]|\d+\.)\s+\[[ xX]\])\s*/gm, "$1 ")
    .trim();
}

export function serializeEditableMarkdownForAzureDevOps(value: string) {
  return transformMarkdownLinks(
    normalizeEditableMarkup(value),
    ({ destination, label, marker, suffix }) => {
      const linkParts = splitMarkdownLinkDestination(destination, suffix);
      const rawDestination = unescapeMarkdownLinkDestination(linkParts.destination);

      if (!marker && rawDestination.startsWith("./ado-mention/")) {
        return `@<${decodeAzureDevOpsMentionId(rawDestination.slice("./ado-mention/".length))}>`;
      }

      const originalAssetSource = unwrapAzureDevOpsAssetProxySource(
        linkParts.destination,
      );

      if (!originalAssetSource) {
        return null;
      }

      return `${marker}[${label}](${markdownLinkDestinationForAzureDevOps(originalAssetSource)}${linkParts.suffix})`;
    },
  );
}

function createEditableDescription(
  description: AzureDevOpsTaskDetail["description"],
) {
  switch (description.format) {
    case "html":
      return convertHtmlToEditableMarkdown(description.content);
    case "markdown":
    case "unknown":
      return normalizeEditableMarkup(description.content);
  }
}

function normalizeEditableAssignee(
  assignee: TaskDetailEditableAssignee,
): TaskDetailEditableAssignee {
  const label = normalizeEditableString(assignee.label);
  const value = assignee.value?.trim() || null;

  return {
    avatarUrl: assignee.avatarUrl,
    label: label || "Unassigned",
    value,
  };
}

function comparableAssigneeValue(assignee: TaskDetailEditableAssignee) {
  return assignee.value ?? normalizeEditableString(assignee.label) ?? null;
}

export function createTaskDetailEditableValues(
  detail: Pick<
    AzureDevOpsTaskDetail,
    | "areaPath"
    | "assignee"
    | "assigneeAvatarUrl"
    | "assigneeValue"
    | "description"
    | "iterationPath"
    | "priority"
    | "title"
  >,
): TaskDetailEditableValues {
  return normalizeTaskDetailEditableValues({
    areaPath: detail.areaPath,
    assignee: {
      avatarUrl: detail.assigneeAvatarUrl,
      label: detail.assignee,
      value: detail.assigneeValue,
    },
    description: createEditableDescription(detail.description),
    iterationPath: detail.iterationPath,
    priority: detail.priority,
    title: detail.title,
  });
}

export function normalizeTaskDetailEditableValues(
  values: TaskDetailEditableValues,
): TaskDetailEditableValues {
  return {
    areaPath: normalizeEditableString(values.areaPath),
    assignee: normalizeEditableAssignee(values.assignee),
    description: normalizeEditableMarkup(values.description),
    iterationPath: normalizeEditableString(values.iterationPath),
    priority: normalizeEditableString(values.priority),
    title: normalizeEditableString(values.title),
  };
}

export function getTaskDetailEditableChanges(
  initialValues: TaskDetailEditableValues,
  draftValues: TaskDetailEditableValues,
): TaskDetailEditableChanges {
  const initial = normalizeTaskDetailEditableValues(initialValues);
  const draft = normalizeTaskDetailEditableValues(draftValues);
  const changes: TaskDetailEditableChanges = {};

  if (draft.title !== initial.title) {
    changes.title = draft.title;
  }

  if (draft.priority !== initial.priority) {
    changes.priority = draft.priority;
  }

  if (draft.areaPath !== initial.areaPath) {
    changes.areaPath = draft.areaPath;
  }

  if (draft.description !== initial.description) {
    changes.description = serializeEditableMarkdownForAzureDevOps(draft.description);
  }

  if (draft.iterationPath !== initial.iterationPath) {
    changes.iterationPath = draft.iterationPath;
  }

  if (comparableAssigneeValue(draft.assignee) !== comparableAssigneeValue(initial.assignee)) {
    changes.assignee = draft.assignee.value;
  }

  return changes;
}

export function hasTaskDetailEditableChanges(
  initialValues: TaskDetailEditableValues,
  draftValues: TaskDetailEditableValues,
) {
  return Object.keys(getTaskDetailEditableChanges(initialValues, draftValues)).length > 0;
}

export function applyTaskDetailEditableValues(
  detail: AzureDevOpsTaskDetail,
  values: TaskDetailEditableValues,
): AzureDevOpsTaskDetail {
  const normalizedValues = normalizeTaskDetailEditableValues(values);
  const initialDescription = createEditableDescription(detail.description);
  const descriptionChanged = normalizedValues.description !== initialDescription;

  return {
    ...detail,
    areaPath: normalizedValues.areaPath,
    assignee: normalizedValues.assignee.label,
    assigneeAvatarUrl: normalizedValues.assignee.avatarUrl,
    assigneeValue: normalizedValues.assignee.value,
    description: descriptionChanged
      ? {
          content: normalizedValues.description,
          format: "markdown",
        }
      : detail.description,
    iterationPath: normalizedValues.iterationPath,
    priority: normalizedValues.priority,
    title: normalizedValues.title,
  };
}
