import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";
import { listAreaPathOptions } from "@/lib/azure-devops/tasks";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
    );
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
    return createAzureDevOpsErrorResponse(error);
  }
}
