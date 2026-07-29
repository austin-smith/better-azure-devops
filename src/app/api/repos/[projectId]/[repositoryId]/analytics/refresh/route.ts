import { NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { getRepository } from "@/lib/azure-devops/git/repositories";
import { loadAzureDevOpsProjectSelection } from "@/lib/azure-devops/project-selection";
import {
  enqueueRepositorySync,
  saveRepository,
} from "@/lib/analytics/refresh";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{ projectId: string; repositoryId: string }>;
  },
) {
  const { projectId, repositoryId } = await context.params;

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const selection =
      await loadAzureDevOpsProjectSelection(accessToken);

    if (!selection.selectedProjectIds.includes(projectId)) {
      return NextResponse.json(
        {
          error:
            "Select this Azure DevOps project before syncing analytics.",
        },
        { status: 409 },
      );
    }

    const repository = await getRepository(
      accessToken,
      projectId,
      repositoryId,
    );

    saveRepository(repository);

    if (repository.isDisabled) {
      return NextResponse.json(
        { error: "This repository is disabled in Azure DevOps." },
        { status: 409 },
      );
    }

    const job = enqueueRepositorySync(
      repository.id,
      "manual",
    );

    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    return createAzureDevOpsErrorResponse(error);
  }
}
