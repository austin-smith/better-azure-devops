import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions, hasMicrosoftEntraConfig } from "@/lib/auth";
import { listWorkItemTypes } from "@/lib/azure-devops/tasks";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";

export async function GET() {
  if (!hasAzureDevOpsConfig() || !hasMicrosoftEntraConfig()) {
    return NextResponse.json(
      {
        error:
          "Runtime config is missing. Set Microsoft Entra and Azure DevOps environment variables.",
      },
      { status: 503 },
    );
  }

  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const types = await listWorkItemTypes(session.accessToken);

    return NextResponse.json({ items: types });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list work item types.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
