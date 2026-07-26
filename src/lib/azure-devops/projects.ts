import {
  AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
  getAzureDevOpsMetadataCacheTags,
} from "@/lib/azure-devops/cache-scope";
import { azureDevOpsFetch } from "@/lib/azure-devops/client";
import { getContinuationToken } from "@/lib/azure-devops/pagination";

export type AzureDevOpsProject = {
  defaultTeamImageUrl: string | null;
  id: string;
  name: string;
  state: string;
  url: string;
};

type ProjectsResponse = {
  value?: unknown[];
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compareProjects(
  left: AzureDevOpsProject,
  right: AzureDevOpsProject,
) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export async function listProjects(accessToken: string) {
  const projects: AzureDevOpsProject[] = [];
  let continuationToken: string | null = null;

  do {
    const searchParams = new URLSearchParams({
      "$top": "1000",
      getDefaultTeamImageUrl: "true",
      stateFilter: "wellFormed",
    });

    if (continuationToken) {
      searchParams.set("continuationToken", continuationToken);
    }

    const response = await azureDevOpsFetch(
      `/_apis/projects?${searchParams}`,
      {
        accessToken,
        cache: "force-cache",
        next: {
          revalidate: AZURE_DEVOPS_METADATA_REVALIDATE_SECONDS,
          tags: getAzureDevOpsMetadataCacheTags(accessToken, "projects"),
        },
      },
    );
    const payload = (await response.json()) as ProjectsResponse;

    projects.push(
      ...(payload.value ?? [])
        .map((project) => {
          if (!project || typeof project !== "object") {
            return null;
          }

          const record = project as Record<string, unknown>;
          const id = readString(record.id);
          const name = readString(record.name);

          if (!id || !name) {
            return null;
          }

          return {
            defaultTeamImageUrl: readString(record.defaultTeamImageUrl),
            id,
            name,
            state: readString(record.state) ?? "unknown",
            url: readString(record.url) ?? "",
          } satisfies AzureDevOpsProject;
        })
        .filter((project): project is AzureDevOpsProject => Boolean(project)),
    );

    continuationToken = getContinuationToken(response.headers);
  } while (continuationToken);

  return projects.sort(compareProjects);
}
