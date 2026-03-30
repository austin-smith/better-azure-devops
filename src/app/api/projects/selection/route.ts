import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  loadAzureDevOpsProjectSelection,
  saveAzureDevOpsProjectSelection,
} from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.";

function parseProjectIds(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const projectIds = value
    .map((projectId) => (typeof projectId === "string" ? projectId.trim() : ""))
    .filter(Boolean);

  return projectIds;
}

export async function GET() {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json({ error: MISSING_CONFIG_ERROR }, { status: 503 });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await loadAzureDevOpsProjectSelection(accessToken);

    return NextResponse.json({
      availableProjects: selection.availableProjects,
      selectedProjectIds: selection.selectedProjectIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load selected projects.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json({ error: MISSING_CONFIG_ERROR }, { status: 503 });
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

  const projectIds = parseProjectIds((payload as Record<string, unknown>).projectIds);

  if (!projectIds) {
    return NextResponse.json(
      { error: "Request must include a valid projectIds array." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await saveAzureDevOpsProjectSelection(accessToken, projectIds);

    return NextResponse.json({
      availableProjects: selection.availableProjects,
      selectedProjectIds: selection.selectedProjectIds,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save selected projects.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
