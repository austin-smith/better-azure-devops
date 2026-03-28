import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { listTasks, type TaskView } from "@/lib/azure-devops/tasks";

function parseTaskView(value: string | null): TaskView {
  return value === "mine" ? "mine" : "all";
}

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
      },
      { status: 503 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const view = parseTaskView(request.nextUrl.searchParams.get("view"));
    const tasks = await listTasks(accessToken, view);

    return NextResponse.json({ items: tasks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load tasks.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
