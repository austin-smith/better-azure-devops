import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { getTeamAreaSettings } from "@/lib/azure-devops/tasks";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json({ error: MISSING_CONFIG_ERROR }, { status: 503 });
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
    const message =
      error instanceof Error ? error.message : "Failed to load area settings.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
