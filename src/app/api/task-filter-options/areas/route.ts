import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { listAreaPathOptions } from "@/lib/azure-devops/tasks";

const MISSING_CONFIG_ERROR =
  "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json({ error: MISSING_CONFIG_ERROR }, { status: 503 });
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const items = await listAreaPathOptions(accessToken, query);

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load area paths.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
