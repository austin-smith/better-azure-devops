import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import { createTask } from "@/lib/azure-devops/tasks";

function parseRequiredString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return typeof value === "string" ? value.trim() || undefined : null;
}

function parseOptionalDescription(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  return value.trim() ? value.replace(/\r\n?/g, "\n") : undefined;
}

async function resolveProject(accessToken: string, projectId: string | null) {
  const selection = await loadAzureDevOpsProjectSelection(
    accessToken,
    projectId ? [projectId] : undefined,
  );

  if (projectId) {
    return selection.selectedProjects.find((project) => project.id === projectId) ?? null;
  }

  return selection.selectedProjects.length === 1
    ? selection.selectedProjects[0]
    : null;
}

export async function POST(request: NextRequest) {
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

  const record = payload as Record<string, unknown>;
  const areaPath = parseOptionalString(record.areaPath);
  const description = parseOptionalDescription(record.description);
  const priority = parseOptionalString(record.priority);
  const projectId = parseRequiredString(record.projectId);
  const title = parseRequiredString(record.title);
  const type = parseRequiredString(record.type);

  if (
    !projectId ||
    !title ||
    !type ||
    areaPath === null ||
    description === null ||
    priority === null
  ) {
    return NextResponse.json(
      { error: "Project, work item type, and title are required." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const project = await resolveProject(accessToken, projectId);

    if (!project) {
      return NextResponse.json(
        { error: "Select a valid Azure DevOps project." },
        { status: 400 },
      );
    }

    const task = await createTask(
      accessToken,
      {
        areaPath,
        description,
        priority,
        projectName: project.name,
        title,
        type,
      },
      {
        projectId: project.id,
        projectImageUrl: project.defaultTeamImageUrl,
        projectName: project.name,
      },
    );

    return NextResponse.json({ item: task }, { status: 201 });
  } catch (error) {
    return createAzureDevOpsErrorResponse(error);
  }
}
