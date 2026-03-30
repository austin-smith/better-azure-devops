import {
  getLegacyAzureDevOpsProject,
} from "@/lib/azure-devops/config";
import {
  listProjects,
  type AzureDevOpsProject,
} from "@/lib/azure-devops/projects";
import {
  readAppSetting,
  writeAppSetting,
} from "@/db/repositories/app-settings";

const SELECTED_PROJECT_IDS_KEY = "azure-devops.selected-project-ids.v1";

type StoredProjectSelection = {
  projectIds: string[];
};

export type AzureDevOpsProjectSelection = {
  availableProjects: AzureDevOpsProject[];
  selectedProjectIds: string[];
  selectedProjects: AzureDevOpsProject[];
  source: "empty" | "legacy-env" | "saved" | "url";
};

function normalizeProjectIds(projectIds: readonly string[]) {
  const seen = new Set<string>();
  const normalizedIds: string[] = [];

  for (const projectId of projectIds) {
    const normalizedId = projectId.trim();

    if (!normalizedId || seen.has(normalizedId)) {
      continue;
    }

    seen.add(normalizedId);
    normalizedIds.push(normalizedId);
  }

  return normalizedIds;
}

function parseStoredProjectSelection(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as StoredProjectSelection;
    return normalizeProjectIds(
      Array.isArray(parsed.projectIds) ? parsed.projectIds : [],
    );
  } catch {
    return [];
  }
}

function saveStoredProjectSelection(projectIds: readonly string[]) {
  writeAppSetting(
    SELECTED_PROJECT_IDS_KEY,
    JSON.stringify({ projectIds: normalizeProjectIds(projectIds) }),
  );
}

function getStoredProjectSelection() {
  return parseStoredProjectSelection(readAppSetting(SELECTED_PROJECT_IDS_KEY));
}

function resolveProjects(
  availableProjects: readonly AzureDevOpsProject[],
  projectIds: readonly string[],
) {
  const projectsById = new Map(
    availableProjects.map((project) => [project.id, project]),
  );

  return normalizeProjectIds(projectIds)
    .map((projectId) => projectsById.get(projectId))
    .filter((project): project is AzureDevOpsProject => Boolean(project));
}

function resolveLegacyProject(
  availableProjects: readonly AzureDevOpsProject[],
) {
  const legacyProject = getLegacyAzureDevOpsProject();

  if (!legacyProject) {
    return null;
  }

  const normalizedLegacyProject = legacyProject.toLowerCase();

  return (
    availableProjects.find((project) => project.id.toLowerCase() === normalizedLegacyProject) ??
    availableProjects.find((project) => project.name.toLowerCase() === normalizedLegacyProject) ??
    null
  );
}

export async function loadAzureDevOpsProjectSelection(
  accessToken: string,
  preferredProjectIds: readonly string[] = [],
): Promise<AzureDevOpsProjectSelection> {
  const availableProjects = await listProjects(accessToken);
  const normalizedPreferredProjectIds = normalizeProjectIds(preferredProjectIds);
  const preferredProjects = resolveProjects(availableProjects, preferredProjectIds);

  if (normalizedPreferredProjectIds.length > 0) {
    return {
      availableProjects,
      selectedProjectIds: normalizedPreferredProjectIds,
      selectedProjects: preferredProjects,
      source: "url",
    };
  }

  const storedProjects = resolveProjects(
    availableProjects,
    getStoredProjectSelection(),
  );

  if (storedProjects.length > 0) {
    return {
      availableProjects,
      selectedProjectIds: storedProjects.map((project) => project.id),
      selectedProjects: storedProjects,
      source: "saved",
    };
  }

  const legacyProject = resolveLegacyProject(availableProjects);

  if (legacyProject) {
    saveStoredProjectSelection([legacyProject.id]);

    return {
      availableProjects,
      selectedProjectIds: [legacyProject.id],
      selectedProjects: [legacyProject],
      source: "legacy-env",
    };
  }

  return {
    availableProjects,
    selectedProjectIds: [],
    selectedProjects: [],
    source: "empty",
  };
}

export async function saveAzureDevOpsProjectSelection(
  accessToken: string,
  projectIds: readonly string[],
) {
  const availableProjects = await listProjects(accessToken);
  const selectedProjects = resolveProjects(availableProjects, projectIds);
  const selectedProjectIds = selectedProjects.map((project) => project.id);

  saveStoredProjectSelection(selectedProjectIds);

  return {
    availableProjects,
    selectedProjectIds,
    selectedProjects,
    source: "saved",
  } satisfies AzureDevOpsProjectSelection;
}
