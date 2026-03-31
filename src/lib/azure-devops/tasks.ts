import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import {
  buildAzureDevOpsAssetProxyPath,
  isAzureDevOpsAssetUrl,
} from "@/lib/azure-devops/assets";
import { getAzureDevOpsOrganizationName } from "@/lib/azure-devops/config";
import {
  getDefaultTaskListFilters,
  type TaskListFilters,
} from "@/lib/tasks/filters";
import { getDefaultWorkItemTypes } from "@/lib/tasks/work-item-type";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";
import sanitizeHtml from "sanitize-html";

export type AzureDevOpsTaskListItem = {
  areaPath: string;
  assignee: string;
  assigneeAvatarUrl: string | null;
  id: number;
  iterationPath: string;
  priority: string;
  projectId: string | null;
  projectImageUrl: string | null;
  projectName: string;
  state: string;
  title: string;
  type: string;
  updatedAt: string;
};

export type AzureDevOpsTask = AzureDevOpsTaskListItem;

export type AzureDevOpsTaskComment = {
  authorAvatarUrl: string | null;
  authorName: string;
  createdAt: string;
  format: "html" | "markdown" | "unknown";
  html: string;
  id: number;
  text: string;
};

export type AzureDevOpsLinkedPullRequest = {
  authorAvatarUrl: string | null;
  authorName: string;
  createdAt: string;
  id: number;
  isDraft: boolean;
  repositoryName: string;
  sourceBranch: string;
  state: string;
  targetBranch: string;
  title: string;
  url: string;
};

export type AzureDevOpsTaskDetail = AzureDevOpsTask & {
  comments: AzureDevOpsTaskComment[];
  descriptionHtml: string;
  linkedPullRequests: AzureDevOpsLinkedPullRequest[];
  revision: number;
  reason: string;
  tags: string[];
  url: string;
};

export type AzureDevOpsAssigneeOption = {
  avatarUrl: string | null;
  key: string;
  name: string;
  secondaryText: string;
  value: string;
};

export type AzureDevOpsClassificationPathOption = {
  key: string;
  name: string;
  projectId: string;
  projectName: string;
  secondaryText: string;
  value: string;
};

type WiqlResponse = {
  workItems: Array<{
    id: number;
  }>;
};

type WorkItemLink = {
  href?: string;
};

type WorkItemRelation = {
  attributes?: Record<string, unknown>;
  rel?: string;
  url?: string;
};

type WorkItem = {
  _links?: Record<string, unknown>;
  fields: Record<string, unknown>;
  id: number;
  relations?: WorkItemRelation[];
  rev?: number;
};

type WorkItemsResponse = {
  value: WorkItem[];
};

type Comment = {
  commentId?: number;
  createdBy?: unknown;
  createdDate?: string;
  format?: string;
  id?: number;
  isDeleted?: boolean;
  renderedText?: string;
  text?: string;
};

type CommentsResponse = {
  comments?: Comment[];
};

type PullRequest = {
  _links?: Record<string, unknown>;
  createdBy?: unknown;
  creationDate?: string;
  isDraft?: boolean;
  pullRequestId: number;
  repository?: {
    name?: string;
  };
  sourceRefName?: string;
  status?: string;
  targetRefName?: string;
  title?: string;
};

type GraphUser = {
  _links?: Record<string, unknown>;
  descriptor?: string;
  displayName?: string;
  id?: string;
  mailAddress?: string;
  principalName?: string;
};

type UserEntitlement = {
  id?: string;
  user?: GraphUser;
};

type UserEntitlementsResponse = {
  items?: UserEntitlement[];
};

type ParsedIdentity = {
  avatarUrl: string | null;
  name: string;
};

type ClassificationNodeKind = "areas" | "iterations";

type ClassificationNode = {
  children?: ClassificationNode[];
  hasChildren?: boolean;
  id?: number;
  identifier?: string;
  name?: string;
  path?: string;
};

type WorkItemBatchRequest = {
  errorPolicy: "omit";
  fields: readonly string[];
  ids: number[];
};

type TaskProjectContext = Pick<
  AzureDevOpsProject,
  "defaultTeamImageUrl" | "id" | "name"
>;

type TaskRequestContext = {
  projectId?: string | null;
  projectImageUrl?: string | null;
  projectName?: string | null;
};

const TASK_LIST_FIELDS = [
  "System.AreaPath",
  "System.AssignedTo",
  "System.ChangedDate",
  "System.IterationPath",
  "System.State",
  "System.TeamProject",
  "System.Title",
  "System.WorkItemType",
  "Microsoft.VSTS.Common.Priority",
] as const;
const SANITIZE_ALLOWED_TAGS = [
  ...(sanitizeHtml.defaults.allowedTags ?? []),
  "img",
];
const SANITIZE_ALLOWED_ATTRIBUTES = {
  ...sanitizeHtml.defaults.allowedAttributes,
  a: [
    ...(sanitizeHtml.defaults.allowedAttributes.a ?? []),
    "data-vss-mention",
    "rel",
    "target",
  ],
  img: ["alt", "src", "title"],
};
const WORK_ITEMS_BATCH_LIMIT = 200;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseIdentity(value: unknown, fallbackName = "Unknown user"): ParsedIdentity {
  if (typeof value === "string") {
    return {
      avatarUrl: null,
      name: value,
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const links =
      record._links && typeof record._links === "object"
        ? (record._links as Record<string, unknown>)
        : null;
    const avatar =
      links?.avatar && typeof links.avatar === "object"
        ? (links.avatar as Record<string, unknown>)
        : null;

    return {
      avatarUrl: readString(record.imageUrl) ?? readString(avatar?.href),
      name:
        readString(record.displayName) ??
        readString(record.uniqueName) ??
        fallbackName,
    };
  }

  return {
    avatarUrl: null,
    name: fallbackName,
  };
}

function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

function escapeWiqlString(value: string) {
  return value.replace(/'/g, "''");
}

function normalizePlainText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    const normalizedCode = code.toLowerCase();

    if (normalizedCode.startsWith("#x")) {
      const parsed = Number.parseInt(normalizedCode.slice(2), 16);
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
    }

    if (normalizedCode.startsWith("#")) {
      const parsed = Number.parseInt(normalizedCode.slice(1), 10);
      return Number.isNaN(parsed) ? entity : String.fromCodePoint(parsed);
    }

    return HTML_ENTITY_MAP[normalizedCode] ?? entity;
  });
}

function extractRenderedMentionLabels(renderedText: string) {
  const mentions = new Map<string, string>();

  for (const match of renderedText.matchAll(
    /<a\b[^>]*\bdata-vss-mention="[^"]*?,([^"]+)"[^>]*>(.*?)<\/a>/gi,
  )) {
    const mentionId = match[1]?.trim().toLowerCase();
    const mentionLabel = decodeHtmlEntities(
      sanitizeHtml(match[2] ?? "", {
        allowedAttributes: {},
        allowedTags: [],
      }).trim(),
    );

    if (mentionId && mentionLabel) {
      mentions.set(mentionId, mentionLabel);
    }
  }

  return mentions;
}

function escapeMarkdownLinkText(value: string) {
  return value.replace(/([\\[\]])/g, "\\$1");
}

function normalizeAzureDevOpsMarkdown(text: string, renderedText?: string) {
  const normalizedText = normalizePlainText(decodeHtmlEntities(text));

  if (!renderedText?.trim()) {
    return normalizedText;
  }

  const mentionLabels = extractRenderedMentionLabels(renderedText);

  return normalizedText.replace(/@<([^>]+)>/g, (token, mentionId) => {
    const normalizedMentionId = String(mentionId).trim().toLowerCase();
    const mentionLabel = mentionLabels.get(normalizedMentionId);

    if (!mentionLabel) {
      return token;
    }

    return `[${escapeMarkdownLinkText(mentionLabel)}](./ado-mention/${normalizedMentionId})`;
  });
}

function normalizeTaskPath(value: unknown) {
  const normalizedValue = readString(value);

  if (!normalizedValue) {
    return "";
  }

  return normalizedValue
    .split("\\")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("\\");
}

function normalizeClassificationFilterPath(
  kind: ClassificationNodeKind,
  path: string,
) {
  const segments = normalizeTaskPath(path).split("\\").filter(Boolean);

  if (segments.length < 2) {
    return segments.join("\\");
  }

  const classificationLabels =
    kind === "areas"
      ? new Set(["area", "areas"])
      : new Set(["iteration", "iterations"]);

  if (!classificationLabels.has(segments[1]?.toLowerCase() ?? "")) {
    return segments.join("\\");
  }

  return [segments[0], ...segments.slice(2)].join("\\");
}

function isValidClassificationFilterPath(
  projects: readonly TaskProjectContext[],
  path: string,
) {
  const segments = normalizeTaskPath(path).split("\\").filter(Boolean);

  if (segments.length < 2) {
    return false;
  }

  const projectSegment = segments[0]?.toLowerCase() ?? "";

  return projects.some(
    (project) => normalizeTaskPath(project.name).toLowerCase() === projectSegment,
  );
}

function chunkIds(ids: number[], size: number) {
  const chunks: number[][] = [];

  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

function sanitizeAzureDevOpsHtml(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  return sanitizeHtml(value, {
    allowedAttributes: SANITIZE_ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: SANITIZE_ALLOWED_TAGS,
    transformTags: {
      a: (tagName, attribs) => {
        const href = typeof attribs.href === "string" ? attribs.href : "";
        const nextAttribs = { ...attribs };

        if (typeof nextAttribs["data-vss-mention"] === "string") {
          delete nextAttribs.href;
          delete nextAttribs.rel;
          delete nextAttribs.target;

          return {
            attribs: nextAttribs,
            tagName,
          };
        }

        if (href.startsWith("http://") || href.startsWith("https://")) {
          nextAttribs.rel = "noreferrer noopener";
          nextAttribs.target = "_blank";
        }

        return {
          attribs: nextAttribs,
          tagName,
        };
      },
      img: (tagName, attribs) => {
        const source = typeof attribs.src === "string" ? attribs.src : "";
        const nextAttribs = { ...attribs };

        if (isAzureDevOpsAssetUrl(source)) {
          nextAttribs.src = buildAzureDevOpsAssetProxyPath(source);
        }

        return {
          attribs: nextAttribs,
          tagName,
        };
      },
    },
  });
}

function parseCommentFormat(value: unknown): AzureDevOpsTaskComment["format"] {
  if (typeof value !== "string") {
    return "unknown";
  }

  switch (value.toLowerCase()) {
    case "html":
      return "html";
    case "markdown":
      return "markdown";
    default:
      return "unknown";
  }
}

function parseStringList(value: unknown) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeBranchName(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/^refs\/heads\//, "");
}

function extractLinkHref(links: unknown, key: string) {
  if (!links || typeof links !== "object") {
    return null;
  }

  const link = (links as Record<string, unknown>)[key];

  if (!link || typeof link !== "object") {
    return null;
  }

  return readString((link as WorkItemLink).href);
}

function parsePullRequestId(relation: WorkItemRelation) {
  if (!relation.url) {
    return null;
  }

  const decoded = decodeURIComponent(relation.url);

  if (!decoded.startsWith("vstfs:///Git/PullRequestId/")) {
    return null;
  }

  const segments = decoded.split("/");
  const pullRequestId = Number(segments.at(-1));

  return Number.isInteger(pullRequestId) ? pullRequestId : null;
}

function resolveTaskProject(
  projectName: string,
  projectsByName: ReadonlyMap<string, TaskProjectContext>,
) {
  return projectsByName.get(projectName.toLowerCase()) ?? null;
}

function toTaskListItem(
  workItem: WorkItem,
  projectsByName: ReadonlyMap<string, TaskProjectContext> = new Map(),
  fallbackProjectName?: string,
): AzureDevOpsTask {
  const assignee = parseIdentity(workItem.fields["System.AssignedTo"], "Unassigned");
  const projectName =
    readString(workItem.fields["System.TeamProject"]) ??
    readString(fallbackProjectName) ??
    "Unknown project";
  const taskProject = resolveTaskProject(projectName, projectsByName);

  return {
    areaPath: normalizeTaskPath(workItem.fields["System.AreaPath"]),
    assignee: assignee.name,
    assigneeAvatarUrl: assignee.avatarUrl,
    id: workItem.id,
    iterationPath: normalizeTaskPath(workItem.fields["System.IterationPath"]),
    priority: String(workItem.fields["Microsoft.VSTS.Common.Priority"] ?? ""),
    projectId: taskProject?.id ?? null,
    projectImageUrl: taskProject?.defaultTeamImageUrl ?? null,
    projectName,
    state: String(workItem.fields["System.State"] ?? ""),
    title: String(workItem.fields["System.Title"] ?? `Work item ${workItem.id}`),
    type: String(workItem.fields["System.WorkItemType"] ?? "Task"),
    updatedAt: String(workItem.fields["System.ChangedDate"] ?? ""),
  };
}

function compareClassificationPathOptions(
  left: AzureDevOpsClassificationPathOption,
  right: AzureDevOpsClassificationPathOption,
) {
  return left.value.localeCompare(right.value, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function flattenClassificationNodes(
  kind: ClassificationNodeKind,
  node: ClassificationNode,
  project: TaskProjectContext,
  options: AzureDevOpsClassificationPathOption[],
  depth = 0,
  parentPath = "",
  parentNormalizedPath = "",
) {
  const name = readString(node.name) ?? "";
  const path = normalizeTaskPath(node.path ?? [parentPath, name].filter(Boolean).join("\\"));
  const normalizedPath = normalizeClassificationFilterPath(kind, path);
  const identifier = readString(node.identifier);
  const secondaryText =
    normalizedPath && normalizedPath !== name ? normalizedPath : "";

  if (
    depth > 0 &&
    normalizedPath &&
    normalizedPath !== parentNormalizedPath &&
    isValidClassificationFilterPath([project], normalizedPath)
  ) {
    options.push({
      key: `${project.id}:${identifier ?? String(node.id ?? normalizedPath)}`,
      name: name || path,
      projectId: project.id,
      projectName: project.name,
      secondaryText,
      value: normalizedPath,
    });
  }

  for (const child of node.children ?? []) {
    flattenClassificationNodes(
      kind,
      child,
      project,
      options,
      depth + 1,
      path,
      normalizedPath,
    );
  }
}

async function listClassificationPathOptions(
  accessToken: string,
  projects: readonly TaskProjectContext[],
  kind: ClassificationNodeKind,
  query = "",
) {
  const options: AzureDevOpsClassificationPathOption[] = [];
  const seen = new Set<string>();
  const normalizedQuery = query.trim().toLowerCase();

  const responses = await Promise.all(
    projects.map(async (project) => {
      const response = await azureDevOpsRequest<ClassificationNode>(
        `/_apis/wit/classificationnodes/${kind}?$depth=100`,
        {
          accessToken,
          projectName: project.name,
        },
      );

      return {
        project,
        response,
      };
    }),
  );

  for (const { project, response } of responses) {
    flattenClassificationNodes(kind, response, project, options);
  }

  return options
    .filter((option) => {
      const key = `${option.projectId}:${option.value.toLowerCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .filter((option) => {
      if (!normalizedQuery) {
        return true;
      }

      return (
        option.projectName.toLowerCase().includes(normalizedQuery) ||
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.value.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort(compareClassificationPathOptions);
}

function toAssigneeOption(entitlement: UserEntitlement): AzureDevOpsAssigneeOption | null {
  const user = entitlement.user;

  if (!user) {
    return null;
  }

  const value =
    readString(user.mailAddress) ??
    readString(user.principalName) ??
    readString(user.displayName);

  if (!value) {
    return null;
  }

  const identity = parseIdentity(user, value);

  const secondaryText =
    readString(user.mailAddress) ??
    readString(user.principalName) ??
    "";

  return {
    avatarUrl: identity.avatarUrl,
    key: readString(user.descriptor) ?? readString(entitlement.id) ?? value,
    name: identity.name,
    secondaryText:
      secondaryText && secondaryText !== identity.name ? secondaryText : "",
    value,
  };
}

function toComment(comment: Comment): AzureDevOpsTaskComment | null {
  const id = comment.id ?? comment.commentId;

  if (!id) {
    return null;
  }

  const author = parseIdentity(comment.createdBy);
  const format = parseCommentFormat(comment.format);

  return {
    authorAvatarUrl: author.avatarUrl,
    authorName: author.name,
    createdAt: String(comment.createdDate ?? ""),
    format,
    html: format === "html" ? sanitizeAzureDevOpsHtml(comment.text) : "",
    id,
    text:
      typeof comment.text === "string"
        ? format === "markdown"
          ? normalizeAzureDevOpsMarkdown(comment.text, comment.renderedText)
          : normalizePlainText(comment.text)
        : "",
  };
}

function toLinkedPullRequest(pullRequest: PullRequest): AzureDevOpsLinkedPullRequest {
  const author = parseIdentity(pullRequest.createdBy);

  return {
    authorAvatarUrl: author.avatarUrl,
    authorName: author.name,
    createdAt: String(pullRequest.creationDate ?? ""),
    id: pullRequest.pullRequestId,
    isDraft: Boolean(pullRequest.isDraft),
    repositoryName: readString(pullRequest.repository?.name) ?? "Unknown repository",
    sourceBranch: normalizeBranchName(pullRequest.sourceRefName),
    state: String(pullRequest.status ?? "unknown"),
    targetBranch: normalizeBranchName(pullRequest.targetRefName),
    title: readString(pullRequest.title) ?? `Pull request #${pullRequest.pullRequestId}`,
    url:
      extractLinkHref(pullRequest._links, "web") ??
      extractLinkHref(pullRequest._links, "html") ??
      "",
  };
}

async function listTaskComments(
  accessToken: string,
  workItemId: number,
  projectName: string,
) {
  try {
    const response = await azureDevOpsRequest<CommentsResponse>(
      `/_apis/wit/workItems/${workItemId}/comments?$top=20&order=desc&$expand=renderedText&api-version=7.1-preview.4`,
      {
        accessToken,
        projectName,
      },
    );

    return (response.comments ?? [])
      .filter((comment) => !comment.isDeleted)
      .map(toComment)
      .filter((comment): comment is AzureDevOpsTaskComment => Boolean(comment));
  } catch {
    return [];
  }
}

async function listLinkedPullRequests(
  accessToken: string,
  relations: WorkItemRelation[] | undefined,
) {
  const pullRequestIds = [...new Set(
    (relations ?? [])
      .filter((relation) => {
        const linkName = readString(relation.attributes?.name);
        return linkName === "Pull Request" || relation.url?.includes("PullRequestId");
      })
      .map(parsePullRequestId)
      .filter((pullRequestId): pullRequestId is number => Boolean(pullRequestId)),
  )];

  if (pullRequestIds.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(
    pullRequestIds.map((pullRequestId) =>
      azureDevOpsRequest<PullRequest>(`/_apis/git/pullrequests/${pullRequestId}`, {
        accessToken,
      }),
    ),
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<PullRequest> =>
        result.status === "fulfilled",
    )
    .map((result) => toLinkedPullRequest(result.value))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listTasks(
  accessToken: string,
  selectedProjects: readonly TaskProjectContext[],
  filters: TaskListFilters = getDefaultTaskListFilters(),
) {
  if (selectedProjects.length === 0) {
    return [];
  }

  const workItemTypes =
    filters.types.length > 0 ? filters.types : getDefaultWorkItemTypes();
  const projectNames = selectedProjects.map((project) => project.name);
  const projectsByName = new Map(
    selectedProjects.map((project) => [project.name.toLowerCase(), project]),
  );
  const normalizedAreaPath = filters.areaPath
    ? normalizeClassificationFilterPath("areas", filters.areaPath)
    : "";
  const normalizedIterationPath = filters.iterationPath
    ? normalizeClassificationFilterPath("iterations", filters.iterationPath)
    : "";
  const areaPathFilter =
    normalizedAreaPath &&
    isValidClassificationFilterPath(selectedProjects, normalizedAreaPath)
    ? `\n  AND [System.AreaPath] UNDER '${escapeWiqlString(normalizedAreaPath)}'`
    : "";
  const assigneeFilter =
    filters.assignee === "me" ? "\n  AND [System.AssignedTo] = @Me" : "";
  const iterationPathFilter =
    normalizedIterationPath &&
    isValidClassificationFilterPath(selectedProjects, normalizedIterationPath)
    ? `\n  AND [System.IterationPath] UNDER '${escapeWiqlString(normalizedIterationPath)}'`
    : "";
  const stateFilter =
    filters.states.length > 0
      ? `\n  AND [System.State] IN (${filters.states
          .map((state) => `'${escapeWiqlString(state)}'`)
          .join(", ")})`
      : "";
  const priorityFilter =
    filters.priorities.length > 0
      ? `\n  AND [Microsoft.VSTS.Common.Priority] IN (${filters.priorities
          .map((priority) => `'${escapeWiqlString(priority)}'`)
          .join(", ")})`
      : "";
  const workItemTypeFilter = `\n  AND [System.WorkItemType] IN (${workItemTypes
    .map((type) => `'${escapeWiqlString(type)}'`)
    .join(", ")})`;
  const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate]
FROM WorkItems
WHERE [System.TeamProject] IN (${projectNames
    .map((projectName) => `'${escapeWiqlString(projectName)}'`)
    .join(", ")})
${workItemTypeFilter}
${areaPathFilter}
${assigneeFilter}
${iterationPathFilter}
${stateFilter}
${priorityFilter}
  AND [System.State] <> 'Closed'
  AND [System.State] <> 'Removed'
ORDER BY [System.ChangedDate] DESC`;

  let result: WiqlResponse;

  try {
    result = await azureDevOpsRequest<WiqlResponse>(
      "/_apis/wit/wiql",
      {
        accessToken,
        method: "POST",
        body: JSON.stringify({ query: wiql }),
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Azure DevOps WIQL request failed.";

    throw new Error(
      `${message} [filters areaPath=${JSON.stringify(filters.areaPath)} normalizedAreaPath=${JSON.stringify(normalizedAreaPath)} iterationPath=${JSON.stringify(filters.iterationPath)} normalizedIterationPath=${JSON.stringify(normalizedIterationPath)} selectedProjects=${JSON.stringify(projectNames)}]`,
    );
  }

  if (result.workItems.length === 0) {
    return [];
  }

  const ids = result.workItems.map((item) => item.id);
  const workItemsResponses = await Promise.all(
    chunkIds(ids, WORK_ITEMS_BATCH_LIMIT).map((batchIds) =>
      azureDevOpsRequest<WorkItemsResponse>(
        "/_apis/wit/workitemsbatch",
        {
          accessToken,
          method: "POST",
          body: JSON.stringify({
            errorPolicy: "omit",
            fields: TASK_LIST_FIELDS,
            ids: batchIds,
          } satisfies WorkItemBatchRequest),
        },
      ),
    ),
  );
  const workItems = workItemsResponses.flatMap((response) => response.value);

  const workItemsById = new Map(
    workItems.map((workItem) => [workItem.id, workItem]),
  );

  return ids
    .map((id) => workItemsById.get(id))
    .filter((workItem): workItem is WorkItem => Boolean(workItem))
    .map((workItem) => toTaskListItem(workItem, projectsByName));
}

export async function getTaskDetails(
  accessToken: string,
  workItemId: number,
  context: TaskRequestContext = {},
) {
  const workItem = await azureDevOpsRequest<WorkItem>(
    `/_apis/wit/workitems/${workItemId}?$expand=relations`,
    { accessToken },
  );
  const projectName =
    readString(workItem.fields["System.TeamProject"]) ?? context.projectName ?? "Unknown project";
  const projectsByName = new Map(
    projectName
      ? [[
        projectName.toLowerCase(),
        {
          defaultTeamImageUrl: context.projectImageUrl ?? null,
          id: context.projectId ?? "",
          name: projectName,
        },
        ]]
      : [],
  );

  const [comments, linkedPullRequests] = await Promise.all([
    listTaskComments(accessToken, workItemId, projectName),
    listLinkedPullRequests(accessToken, workItem.relations),
  ]);

  return {
    ...toTaskListItem(workItem, projectsByName, projectName),
    areaPath: normalizeTaskPath(workItem.fields["System.AreaPath"]),
    comments,
    descriptionHtml: sanitizeAzureDevOpsHtml(workItem.fields["System.Description"]),
    iterationPath: normalizeTaskPath(workItem.fields["System.IterationPath"]),
    linkedPullRequests,
    revision: Number(workItem.rev ?? 0),
    reason: String(workItem.fields["System.Reason"] ?? ""),
    tags: parseStringList(workItem.fields["System.Tags"]),
    type: String(workItem.fields["System.WorkItemType"] ?? "Task"),
    url:
      extractLinkHref(workItem._links, "html") ??
      extractLinkHref(workItem._links, "web") ??
      "",
  } satisfies AzureDevOpsTaskDetail;
}

export async function listAssignableUsers(accessToken: string, query: string) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return [];
  }

  const organization = getAzureDevOpsOrganizationName();
  const filter = `name eq '${escapeODataString(trimmedQuery)}'`;
  const response = await azureDevOpsRequest<UserEntitlementsResponse>(
    `/_apis/userentitlements?$filter=${encodeURIComponent(filter)}`,
    {
      accessToken,
      baseUrl: `https://vsaex.dev.azure.com/${organization}`,
    },
  );

  const seen = new Set<string>();

  return (response.items ?? [])
    .map(toAssigneeOption)
    .filter((item): item is AzureDevOpsAssigneeOption => Boolean(item))
    .filter((item) => {
      const key = item.value.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export async function listAreaPathOptions(
  accessToken: string,
  selectedProjects: readonly TaskProjectContext[],
  query = "",
) {
  return listClassificationPathOptions(accessToken, selectedProjects, "areas", query);
}

export async function listIterationPathOptions(
  accessToken: string,
  selectedProjects: readonly TaskProjectContext[],
  query = "",
) {
  return listClassificationPathOptions(
    accessToken,
    selectedProjects,
    "iterations",
    query,
  );
}

export async function updateTaskAssignee(
  accessToken: string,
  workItemId: number,
  assignee: string | null,
  revision: number,
  context: TaskRequestContext = {},
) {
  await azureDevOpsRequest<WorkItem>(`/_apis/wit/workitems/${workItemId}`, {
    accessToken,
    body: JSON.stringify([
      {
        op: "test",
        path: "/rev",
        value: revision,
      },
      {
        op: "add",
        path: "/fields/System.AssignedTo",
        value: assignee ?? "",
      },
    ]),
    contentType: "application/json-patch+json",
    method: "PATCH",
    projectName: context.projectName,
  });

  return getTaskDetails(accessToken, workItemId, context);
}
