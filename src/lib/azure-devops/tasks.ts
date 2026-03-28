import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import {
  buildAzureDevOpsAssetProxyPath,
  isAzureDevOpsAssetUrl,
} from "@/lib/azure-devops/assets";
import { getAzureDevOpsOrganizationName } from "@/lib/azure-devops/config";
import sanitizeHtml from "sanitize-html";

export type AzureDevOpsTask = {
  assignee: string;
  assigneeAvatarUrl: string | null;
  descriptionHtml: string;
  id: number;
  priority: string;
  state: string;
  title: string;
  updatedAt: string;
};

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
  areaPath: string;
  comments: AzureDevOpsTaskComment[];
  iterationPath: string;
  linkedPullRequests: AzureDevOpsLinkedPullRequest[];
  revision: number;
  reason: string;
  tags: string[];
  type: string;
  url: string;
};

export type AzureDevOpsAssigneeOption = {
  avatarUrl: string | null;
  key: string;
  name: string;
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

export type TaskListFilters = Readonly<{
  assignee?: "me";
}>;

const TASK_FIELDS = [
  "System.AssignedTo",
  "System.ChangedDate",
  "System.Description",
  "System.State",
  "System.Title",
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

function normalizePlainText(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
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

function toTask(workItem: WorkItem): AzureDevOpsTask {
  const assignee = parseIdentity(workItem.fields["System.AssignedTo"], "Unassigned");

  return {
    assignee: assignee.name,
    assigneeAvatarUrl: assignee.avatarUrl,
    descriptionHtml: sanitizeAzureDevOpsHtml(workItem.fields["System.Description"]),
    id: workItem.id,
    priority: String(workItem.fields["Microsoft.VSTS.Common.Priority"] ?? ""),
    state: String(workItem.fields["System.State"] ?? ""),
    title: String(workItem.fields["System.Title"] ?? `Work item ${workItem.id}`),
    updatedAt: String(workItem.fields["System.ChangedDate"] ?? ""),
  };
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
  const html = format === "html" ? sanitizeAzureDevOpsHtml(comment.text) : "";

  return {
    authorAvatarUrl: author.avatarUrl,
    authorName: author.name,
    createdAt: String(comment.createdDate ?? ""),
    format,
    html,
    id,
    text: typeof comment.text === "string" ? normalizePlainText(comment.text) : "",
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

async function listTaskComments(accessToken: string, workItemId: number) {
  try {
    const response = await azureDevOpsRequest<CommentsResponse>(
      `/_apis/wit/workItems/${workItemId}/comments?$top=20&order=desc&$expand=renderedText&api-version=7.1-preview.4`,
      { accessToken },
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
  filters: TaskListFilters = {},
) {
  const assigneeFilter =
    filters.assignee === "me" ? "\n  AND [System.AssignedTo] = @Me" : "";
  const wiql = `SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate]
FROM WorkItems
WHERE [System.TeamProject] = @Project
  AND [System.WorkItemType] = 'Task'
${assigneeFilter}
  AND [System.State] <> 'Closed'
ORDER BY [System.ChangedDate] DESC`;

  const result = await azureDevOpsRequest<WiqlResponse>(
    "/_apis/wit/wiql?$top=50",
    {
      accessToken,
      method: "POST",
      body: JSON.stringify({ query: wiql }),
    },
  );

  if (result.workItems.length === 0) {
    return [];
  }

  const ids = result.workItems.map((item) => item.id);
  const workItems = await azureDevOpsRequest<WorkItemsResponse>(
    "/_apis/wit/workitemsbatch",
    {
      accessToken,
      method: "POST",
      body: JSON.stringify({
        errorPolicy: "omit",
        fields: TASK_FIELDS,
        ids,
      }),
    },
  );

  const workItemsById = new Map(
    workItems.value.map((workItem) => [workItem.id, workItem]),
  );

  return ids
    .map((id) => workItemsById.get(id))
    .filter((workItem): workItem is WorkItem => Boolean(workItem))
    .map(toTask);
}

export async function getTaskDetails(accessToken: string, workItemId: number) {
  const workItem = await azureDevOpsRequest<WorkItem>(
    `/_apis/wit/workitems/${workItemId}?$expand=relations`,
    { accessToken },
  );

  const [comments, linkedPullRequests] = await Promise.all([
    listTaskComments(accessToken, workItemId),
    listLinkedPullRequests(accessToken, workItem.relations),
  ]);

  return {
    ...toTask(workItem),
    areaPath: String(workItem.fields["System.AreaPath"] ?? ""),
    comments,
    iterationPath: String(workItem.fields["System.IterationPath"] ?? ""),
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

export async function updateTaskAssignee(
  accessToken: string,
  workItemId: number,
  assignee: string | null,
  revision: number,
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
  });

  return getTaskDetails(accessToken, workItemId);
}
