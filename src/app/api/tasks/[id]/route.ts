import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { getTaskDetails, updateTaskAssignee } from "@/lib/azure-devops/tasks";

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
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
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
    const task = await getTaskDetails(accessToken, taskId);

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
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
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
  const assignee = parseAssignee(record.assignee);
  const revision = parseRevision(record.revision);

  if (assignee === undefined || !revision) {
    return NextResponse.json(
      { error: "Request must include a valid assignee and revision." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const task = await updateTaskAssignee(accessToken, taskId, assignee, revision);

    return NextResponse.json({ item: task });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update task assignee.";
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
