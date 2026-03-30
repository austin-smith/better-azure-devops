import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { listAssignableUsers } from "@/lib/azure-devops/tasks";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
      },
      { status: 503 },
    );
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ items: [] });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const items = await listAssignableUsers(accessToken, query);

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load assignees.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
