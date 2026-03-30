import { azureDevOpsRequest } from "@/lib/azure-devops/client";

export type AzureDevOpsProject = {
  defaultTeamImageUrl: string | null;
  id: string;
  name: string;
  state: string;
  url: string;
};

type ProjectsResponse = {
  value?: Array<{
    defaultTeamImageUrl?: string;
    id?: string;
    name?: string;
    state?: string;
    url?: string;
  }>;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function compareProjects(left: AzureDevOpsProject, right: AzureDevOpsProject) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export async function listProjects(accessToken: string) {
  const response = await azureDevOpsRequest<ProjectsResponse>(
    "/_apis/projects?$top=1000&stateFilter=wellFormed&getDefaultTeamImageUrl=true",
    { accessToken },
  );

  return (response.value ?? [])
    .map((project) => {
      const id = readString(project.id);
      const name = readString(project.name);

      if (!id || !name) {
        return null;
      }

      return {
        defaultTeamImageUrl: readString(project.defaultTeamImageUrl),
        id,
        name,
        state: readString(project.state) ?? "unknown",
        url: readString(project.url) ?? "",
      } satisfies AzureDevOpsProject;
    })
    .filter((project): project is AzureDevOpsProject => Boolean(project))
    .sort(compareProjects);
}
