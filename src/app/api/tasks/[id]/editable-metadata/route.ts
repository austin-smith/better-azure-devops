import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { getTaskEditMetadata } from "@/lib/azure-devops/tasks";

function parseTaskId(value: string) {
  const taskId = Number(value);
  return Number.isInteger(taskId) && taskId > 0 ? taskId : null;
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

export async function GET(
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

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const taskContext = await resolveTaskContext(
      accessToken,
      request.nextUrl.searchParams.get("project"),
    );
    const metadata = await getTaskEditMetadata(accessToken, taskId, taskContext);

    return NextResponse.json({ item: metadata });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load task edit metadata.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
