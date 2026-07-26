import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { createMissingAzureDevOpsConfigError } from "@/lib/azure-devops/errors";
import { listAssignableUsers } from "@/lib/azure-devops/tasks";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return createAzureDevOpsErrorResponse(
      createMissingAzureDevOpsConfigError(),
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
    return createAzureDevOpsErrorResponse(error);
  }
}
