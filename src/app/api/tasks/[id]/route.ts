import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasMicrosoftEntraConfig } from "@/lib/auth";
import { getTask, updateTask } from "@/lib/azure-devops/tasks";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";

function parseId(value: string) {
  const id = Number.parseInt(value, 10);

  if (Number.isNaN(id)) {
    throw new Error("Task id must be a number.");
  }

  return id;
}

function configMissingResponse() {
  return NextResponse.json(
    {
      error:
        "Runtime config is missing. Set Microsoft Entra and Azure DevOps environment variables.",
    },
    { status: 503 },
  );
}

async function getAccessToken() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    throw new Error("Unauthorized");
  }

  return session.accessToken;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasAzureDevOpsConfig() || !hasMicrosoftEntraConfig()) {
    return configMissingResponse();
  }

  try {
    const accessToken = await getAccessToken();
    const { id } = await context.params;
    const task = await getTask(accessToken, parseId(id));

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch task.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasAzureDevOpsConfig() || !hasMicrosoftEntraConfig()) {
    return configMissingResponse();
  }

  try {
    const accessToken = await getAccessToken();
    const { id } = await context.params;
    const body = (await request.json()) as {
      assignedTo?: string | null;
      description?: string | null;
      state?: string;
      tags?: string[];
      title?: string;
    };

    const task = await updateTask(accessToken, parseId(id), {
      assignedTo:
        typeof body.assignedTo === "string" || body.assignedTo === null
          ? body.assignedTo
          : undefined,
      description:
        typeof body.description === "string" || body.description === null
          ? body.description
          : undefined,
      state: typeof body.state === "string" ? body.state : undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    });

    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to update task.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
