import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";
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
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
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
    return createAzureDevOpsErrorResponse(error);
  }
}
