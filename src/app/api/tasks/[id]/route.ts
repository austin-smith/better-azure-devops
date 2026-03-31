import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { getTaskDetails, updateTask } from "@/lib/azure-devops/tasks";

function parseTaskId(value: string) {
  const taskId = Number(value);
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
}

function parseRevision(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function parseAssignee(value: unknown) {
  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value.trim() || null : undefined;
}

function parseRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseTaskChanges(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const assignee = parseAssignee(record.assignee);
  const areaPath =
    record.areaPath === undefined ? undefined : parseRequiredString(record.areaPath);
  const iterationPath =
    record.iterationPath === undefined
      ? undefined
      : parseRequiredString(record.iterationPath);
  const priority =
    record.priority === undefined ? undefined : parseRequiredString(record.priority);
  const title =
    record.title === undefined ? undefined : parseRequiredString(record.title);

  if (
    (record.assignee !== undefined && assignee === undefined) ||
    (record.areaPath !== undefined && areaPath === undefined) ||
    (record.iterationPath !== undefined && iterationPath === undefined) ||
    (record.priority !== undefined && priority === undefined) ||
    (record.title !== undefined && title === undefined)
  ) {
    return undefined;
  }

  return {
    ...(assignee !== undefined ? { assignee } : {}),
    ...(areaPath !== undefined ? { areaPath } : {}),
    ...(iterationPath !== undefined ? { iterationPath } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(title !== undefined ? { title } : {}),
  };
}

async function resolveTaskContext(accessToken: string, projectId: string | null) {
  if (!projectId) {
    return {};
  }

  const selection = await loadAzureDevOpsProjectSelection(accessToken, [projectId]);
  const project = selection.selectedProjects[0] ?? null;

  return {
    projectId: project?.id ?? projectId,
    projectImageUrl: project?.defaultTeamImageUrl ?? null,
    projectName: project?.name ?? null,
  };
}

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/Azure DevOps request failed \((\d{3})/);

  return match ? Number(match[1]) : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const context = await resolveTaskContext(
      accessToken,
      _request.nextUrl.searchParams.get("project"),
    );
    const task = await getTaskDetails(accessToken, taskId, context);

    return NextResponse.json({ item: task });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load task details.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const taskId = parseTaskId(id);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;
  const changes = parseTaskChanges(record.changes);
  const revision = parseRevision(record.revision);

  if (changes === undefined || !revision) {
    return NextResponse.json(
      { error: "Request must include valid changes and revision." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const context = await resolveTaskContext(
      accessToken,
      request.nextUrl.searchParams.get("project"),
    );
    const task = await updateTask(
      accessToken,
      taskId,
      changes,
      revision,
      context,
    );

    return NextResponse.json({ item: task });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update task.";
    const status = errorStatus(error);

    if (status === 412 || (status === 400 && message.toLowerCase().includes("rev"))) {
      return NextResponse.json(
        { error: "This task changed in Azure DevOps. Refresh and try again." },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: message }, { status: status ?? 500 });
  }
}
