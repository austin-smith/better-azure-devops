import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import {
  loadAzureDevOpsProjectSelection,
  saveAzureDevOpsProjectSelection,
} from "@/lib/azure-devops/project-selection";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";

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
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection = await loadAzureDevOpsProjectSelection(accessToken);

    return NextResponse.json({
      availableProjects: selection.availableProjects,
      selectedProjectIds: selection.selectedProjectIds,
    });
  } catch (error) {
    return createAzureDevOpsErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
    );
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
    return createAzureDevOpsErrorResponse(error);
  }
}
