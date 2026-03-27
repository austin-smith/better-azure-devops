export type AzureDevOpsIdentity = {
  displayName?: string;
  uniqueName?: string;
  imageUrl?: string;
};

export type AzureDevOpsWorkItem = {
  id: number;
  fields: Record<string, unknown>;
  relations?: Array<{
    rel: string;
    url: string;
    attributes?: Record<string, unknown>;
  }>;
  url: string;
};

export type TaskView = "active" | "mine" | "recent" | "unassigned";

export type TaskListItem = {
  areaPath: string | null;
  assignedTo: AzureDevOpsIdentity | null;
  changedDate: string | null;
  id: number;
  iterationPath: string | null;
  state: string | null;
  tags: string[];
  title: string;
  type: string | null;
  url: string;
};

export type TaskDetail = TaskListItem & {
  description: string | null;
  relations: AzureDevOpsWorkItem["relations"];
};

export type CreateTaskInput = {
  assignedTo?: string;
  areaPath?: string;
  description?: string;
  iterationPath?: string;
  tags?: string[];
  title: string;
  type?: string;
};

export type UpdateTaskInput = {
  assignedTo?: string | null;
  description?: string | null;
  state?: string;
  tags?: string[];
  title?: string;
};
