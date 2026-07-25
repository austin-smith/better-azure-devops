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
    changes.description = draft.description;
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
