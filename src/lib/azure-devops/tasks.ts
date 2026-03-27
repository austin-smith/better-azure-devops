import {
  AzureDevOpsIdentity,
  AzureDevOpsWorkItem,
  CreateTaskInput,
  TaskDetail,
  TaskListItem,
  TaskView,
  UpdateTaskInput,
} from "@/lib/azure-devops/types";
import { azureDevOpsRequest } from "@/lib/azure-devops/client";

const TASK_CARD_FIELDS = [
  "System.AreaPath",
  "System.AssignedTo",
  "System.ChangedDate",
  "System.Description",
  "System.IterationPath",
  "System.State",
  "System.Tags",
  "System.Title",
  "System.WorkItemType",
] as const;

type WiqlResponse = {
  workItems: Array<{
    id: number;
    url: string;
  }>;
};

type WorkItemsResponse = {
  value: AzureDevOpsWorkItem[];
};

type WorkItemTypesResponse = {
  value: Array<{
    color?: string;
    description?: string;
    name: string;
    referenceName: string;
  }>;
};

function parseIdentity(value: unknown): AzureDevOpsIdentity | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return { displayName: value };
  }

  if (typeof value === "object") {
    const identity = value as Record<string, unknown>;

    return {
      displayName:
        typeof identity.displayName === "string"
          ? identity.displayName
          : undefined,
      imageUrl:
        typeof identity.imageUrl === "string" ? identity.imageUrl : undefined,
      uniqueName:
        typeof identity.uniqueName === "string"
          ? identity.uniqueName
          : undefined,
    };
  }

  return null;
}

function parseTags(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return value
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function stringField(fields: Record<string, unknown>, key: string) {
  const value = fields[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function workItemToTaskListItem(item: AzureDevOpsWorkItem): TaskListItem {
  return {
    areaPath: stringField(item.fields, "System.AreaPath"),
    assignedTo: parseIdentity(item.fields["System.AssignedTo"]),
    changedDate: stringField(item.fields, "System.ChangedDate"),
    id: item.id,
    iterationPath: stringField(item.fields, "System.IterationPath"),
    state: stringField(item.fields, "System.State"),
    tags: parseTags(item.fields["System.Tags"]),
    title: stringField(item.fields, "System.Title") ?? `Work item ${item.id}`,
    type: stringField(item.fields, "System.WorkItemType"),
    url: item.url,
  };
}

function workItemToTaskDetail(item: AzureDevOpsWorkItem): TaskDetail {
  return {
    ...workItemToTaskListItem(item),
    description: stringField(item.fields, "System.Description"),
    relations: item.relations ?? [],
  };
}

function buildViewWiql(view: TaskView, limit: number) {
  const baseWhere = [
    "[System.TeamProject] = @Project",
    "[System.WorkItemType] = 'Task'",
  ];

  switch (view) {
    case "active":
      baseWhere.push("[System.State] = 'Active'");
      break;
    case "recent":
      baseWhere.push("[System.ChangedDate] >= @Today - 7");
      break;
    case "unassigned":
      baseWhere.push("[System.State] <> 'Closed'");
      baseWhere.push("[System.AssignedTo] = ''");
      break;
    case "mine":
    default:
      baseWhere.push("[System.AssignedTo] = @Me");
      baseWhere.push("[System.State] <> 'Closed'");
      break;
  }

  return `SELECT TOP ${limit} [System.Id], [System.Title], [System.State], [System.AssignedTo], [System.ChangedDate]
FROM WorkItems
WHERE ${baseWhere.join(" AND ")}
ORDER BY [System.ChangedDate] DESC`;
}

function buildFieldsQuery(fields: readonly string[]) {
  return fields.map((field) => `fields=${encodeURIComponent(field)}`).join("&");
}

async function getWorkItems(accessToken: string, ids: number[]) {
  if (ids.length === 0) {
    return [];
  }

  const response = await azureDevOpsRequest<WorkItemsResponse>(
    `/_apis/wit/workitems?ids=${ids.join(",")}&${buildFieldsQuery(
      TASK_CARD_FIELDS,
    )}`,
    {
      accessToken,
    },
  );

  return response.value;
}

function ensureString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function createPatchDocument(input: UpdateTaskInput) {
  const operations: Array<{ op: "add"; path: string; value: unknown }> = [];

  if (input.title) {
    operations.push({
      op: "add",
      path: "/fields/System.Title",
      value: input.title,
    });
  }

  if (input.state) {
    operations.push({
      op: "add",
      path: "/fields/System.State",
      value: input.state,
    });
  }

  if (Object.hasOwn(input, "assignedTo")) {
    operations.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: input.assignedTo ?? "",
    });
  }

  if (Object.hasOwn(input, "description")) {
    operations.push({
      op: "add",
      path: "/fields/System.Description",
      value: input.description ?? "",
    });
  }

  if (input.tags) {
    operations.push({
      op: "add",
      path: "/fields/System.Tags",
      value: input.tags.join("; "),
    });
  }

  return operations;
}

async function queryWiql(accessToken: string, wiql: string) {
  const response = await azureDevOpsRequest<WiqlResponse>("/_apis/wit/wiql", {
    accessToken,
    method: "POST",
    body: JSON.stringify({ query: wiql }),
  });

  return response.workItems.map((item) => item.id);
}

export async function listTasks(accessToken: string, view: TaskView, limit: number) {
  const ids = await queryWiql(accessToken, buildViewWiql(view, limit));
  const items = await getWorkItems(accessToken, ids);

  return items.map(workItemToTaskListItem);
}

export async function getTask(accessToken: string, id: number) {
  const item = await azureDevOpsRequest<AzureDevOpsWorkItem>(
    `/_apis/wit/workitems/${id}?${buildFieldsQuery(TASK_CARD_FIELDS)}&$expand=relations`,
    {
      accessToken,
    },
  );

  return workItemToTaskDetail(item);
}

export async function createTask(accessToken: string, input: CreateTaskInput) {
  const title = ensureString(input.title, "title");
  const type = input.type?.trim() || "Task";
  const operations: Array<{ op: "add"; path: string; value: unknown }> = [
    {
      op: "add",
      path: "/fields/System.Title",
      value: title,
    },
  ];

  if (input.description) {
    operations.push({
      op: "add",
      path: "/fields/System.Description",
      value: input.description,
    });
  }

  if (input.assignedTo) {
    operations.push({
      op: "add",
      path: "/fields/System.AssignedTo",
      value: input.assignedTo,
    });
  }

  if (input.areaPath) {
    operations.push({
      op: "add",
      path: "/fields/System.AreaPath",
      value: input.areaPath,
    });
  }

  if (input.iterationPath) {
    operations.push({
      op: "add",
      path: "/fields/System.IterationPath",
      value: input.iterationPath,
    });
  }

  if (input.tags?.length) {
    operations.push({
      op: "add",
      path: "/fields/System.Tags",
      value: input.tags.join("; "),
    });
  }

  const item = await azureDevOpsRequest<AzureDevOpsWorkItem>(
    `/_apis/wit/workitems/$${encodeURIComponent(type)}`,
    {
      accessToken,
      method: "POST",
      contentType: "application/json-patch+json",
      body: JSON.stringify(operations),
    },
  );

  return workItemToTaskDetail(item);
}

export async function updateTask(
  accessToken: string,
  id: number,
  input: UpdateTaskInput,
) {
  const operations = createPatchDocument(input);

  if (operations.length === 0) {
    throw new Error("Update payload is empty.");
  }

  const item = await azureDevOpsRequest<AzureDevOpsWorkItem>(
    `/_apis/wit/workitems/${id}`,
    {
      accessToken,
      method: "PATCH",
      contentType: "application/json-patch+json",
      body: JSON.stringify(operations),
    },
  );

  return workItemToTaskDetail(item);
}

export async function listWorkItemTypes(accessToken: string) {
  const response = await azureDevOpsRequest<WorkItemTypesResponse>(
    "/_apis/wit/workitemtypes",
    {
      accessToken,
    },
  );

  return response.value.map((type) => ({
    color: type.color ?? null,
    description: type.description ?? null,
    name: type.name,
    referenceName: type.referenceName,
  }));
}
