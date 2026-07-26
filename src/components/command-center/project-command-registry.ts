import type {
  CommandCenterGroup,
  CommandCenterProject,
} from "@/components/command-center/command-registry";

type BuildProjectCommandGroupsOptions = {
  availableProjects: readonly CommandCenterProject[];
  selectedProjectIds: readonly string[];
  toggleProject: (projectId: string) => Promise<void>;
};

export function buildProjectCommandGroups({
  availableProjects,
  selectedProjectIds,
  toggleProject,
}: BuildProjectCommandGroupsOptions): CommandCenterGroup[] {
  if (availableProjects.length === 0) {
    return [];
  }

  return [
    {
      actions: availableProjects.map((project) => {
        const isActive = selectedProjectIds.includes(project.id);

        return {
          checked: isActive,
          description: isActive
            ? "Active project — select to deactivate"
            : "Inactive project — select to activate",
          id: `project-${project.id}`,
          keepOpen: true,
          keywords: ["project", isActive ? "active" : "inactive"],
          label: project.name,
          project,
          run: () => toggleProject(project.id),
        };
      }),
      heading: "Azure DevOps projects",
      id: "projects",
    },
  ];
}
