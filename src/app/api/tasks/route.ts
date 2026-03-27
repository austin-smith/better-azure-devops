import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasMicrosoftEntraConfig } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/azure-devops/tasks";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { TaskView } from "@/lib/azure-devops/types";

const ALLOWED_VIEWS: TaskView[] = ["active", "mine", "recent", "unassigned"];

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

function parseView(value: string | null): TaskView {
  if (value && ALLOWED_VIEWS.includes(value as TaskView)) {
    return value as TaskView;
  }

  return "mine";
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (Number.isNaN(parsed)) {
    return 25;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

export async function GET(request: Request) {
  if (!hasAzureDevOpsConfig() || !hasMicrosoftEntraConfig()) {
    return configMissingResponse();
  }

  try {
    const accessToken = await getAccessToken();
    const { searchParams } = new URL(request.url);
    const view = parseView(searchParams.get("view"));
    const limit = parseLimit(searchParams.get("limit"));
    const tasks = await listTasks(accessToken, view, limit);

    return NextResponse.json({
      count: tasks.length,
      items: tasks,
      limit,
      view,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to list tasks.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasAzureDevOpsConfig() || !hasMicrosoftEntraConfig()) {
    return configMissingResponse();
  }

  try {
    const accessToken = await getAccessToken();
    const body = (await request.json()) as {
      assignedTo?: string;
      areaPath?: string;
      description?: string;
      iterationPath?: string;
      tags?: string[];
      title?: string;
      type?: string;
    };

    const task = await createTask(accessToken, {
      assignedTo: body.assignedTo,
      areaPath: body.areaPath,
      description: body.description,
      iterationPath: body.iterationPath,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      title: typeof body.title === "string" ? body.title : "",
      type: body.type,
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to create task.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
