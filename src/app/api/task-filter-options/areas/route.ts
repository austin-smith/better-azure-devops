import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { listAreaPathOptions } from "@/lib/azure-devops/tasks";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json({ error: MISSING_CONFIG_ERROR }, { status: 503 });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const projectId = request.nextUrl.searchParams.get("project")?.trim() ?? "";
    const selection = await loadAzureDevOpsProjectSelection(
      accessToken,
      projectId ? [projectId] : undefined,
    );
    const items =
      selection.selectedProjects.length > 0
        ? await listAreaPathOptions(accessToken, selection.selectedProjects, query)
        : [];

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load area paths.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
