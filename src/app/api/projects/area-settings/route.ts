import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { getTeamAreaSettings } from "@/lib/azure-devops/tasks";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
    );
  }

  const projectId = request.nextUrl.searchParams.get("project")?.trim() ?? "";

  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await loadAzureDevOpsProjectSelection(accessToken, [projectId]);
    const project = selection.selectedProjects[0] ?? null;

    if (!project) {
      return NextResponse.json(
        { error: "Select a valid Azure DevOps project." },
        { status: 400 },
      );
    }

    const settings = await getTeamAreaSettings(accessToken, project);

    return NextResponse.json({ item: settings });
  } catch (error) {
    return createAzureDevOpsErrorResponse(error);
  }
}
