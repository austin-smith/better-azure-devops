import {
  BugIcon,
  CircleDotIcon,
  Clock3Icon,
  Code2Icon,
  FolderKanbanIcon,
  FolderGit2Icon,
  GitPullRequestArrowIcon,
  HashIcon,
  HouseIcon,
  LayoutListIcon,
  ListFilterIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  UploadIcon,
  UserCircle2Icon,
  type LucideIcon,
} from "lucide-react";
import {
  areTaskListFiltersEqual,
  type TaskListFilterInput,
} from "@/lib/tasks/filters";
import {
  getDefaultTaskListHref,
  getTaskDetailHref,
  getTaskListHref,
} from "@/lib/tasks/navigation";

export type CommandCenterView =
  | "root"
  | "filters"
  | "projects"
  | "appearance";

export type CommandCenterProject = {
  defaultTeamImageUrl: string | null;
  id: string;
  name: string;
};

export type CommandCenterAction = {
  checked?: boolean;
  description: string;
  disabled?: boolean;
  icon?: LucideIcon;
  id: string;
  keepOpen?: boolean;
  keywords: readonly string[];
  label: string;
  nested?: boolean;
  project?: CommandCenterProject;
  run: () => Promise<void> | void;
  shortcut?: readonly string[];
};

export type CommandCenterGroup = {
  actions: readonly CommandCenterAction[];
  heading: string;
  id: string;
};

type BuildNavigationActionsOptions = {
  currentPathname: string;
  currentSearchParams: {
    get: (name: string) => string | null;
  };
  currentTaskFilters: TaskListFilterInput;
  hasActiveProjects: boolean;
  navigate: (href: string) => void;
  openNewWorkItem: () => void;
};

type BuildRootCommandGroupsOptions = BuildNavigationActionsOptions & {
  availableProjects: readonly CommandCenterProject[];
  openView: (view: Exclude<CommandCenterView, "root">) => void;
};

const FILTER_DESTINATIONS = [
  {
    description: "Work items currently in progress",
    filters: { states: ["Active"] },
    icon: CircleDotIcon,
    id: "active-work-items",
    keywords: ["filter", "state", "in progress", "open"],
    label: "Active work items",
  },
  {
    description: "All work items with the Bug type",
    filters: { types: ["Bug"] },
    icon: BugIcon,
    id: "bugs",
    keywords: ["filter", "defect", "issue", "type"],
    label: "Bugs",
  },
  {
    description: "Priority 1 work items",
    filters: { priorities: ["1"] },
    icon: ListFilterIcon,
    id: "priority-one",
    keywords: ["filter", "high", "urgent", "critical"],
    label: "Highest priority",
  },
  {
    description: "Work items without an assignee",
    filters: { assignee: "Unassigned" },
    icon: UserCircle2Icon,
    id: "unassigned",
    keywords: ["filter", "owner", "assignee", "queue"],
    label: "Unassigned work items",
  },
] as const;

function buildNavigationActions({
  currentPathname,
  currentTaskFilters,
  hasActiveProjects,
  navigate,
  openNewWorkItem,
}: BuildNavigationActionsOptions): CommandCenterAction[] {
  const isTaskList = currentPathname === "/tasks";

  return [
    {
      checked: currentPathname === "/",
      description: "Overview of your Azure DevOps work",
      icon: HouseIcon,
      id: "home",
      keywords: ["dashboard", "overview"],
      label: "Home",
      run: () => navigate("/"),
    },
    {
      checked: isTaskList && areTaskListFiltersEqual(currentTaskFilters, {}),
      description: "Browse work across active projects",
      icon: LayoutListIcon,
      id: "work-items",
      keywords: ["all", "tasks", "backlog"],
      label: "All work items",
      run: () => navigate(getDefaultTaskListHref()),
    },
    {
      checked:
        isTaskList &&
        areTaskListFiltersEqual(currentTaskFilters, { assignee: "me" }),
      description: "Work items currently assigned to you",
      icon: UserCircle2Icon,
      id: "your-queue",
      keywords: ["mine", "assigned", "tasks"],
      label: "Your Queue",
      run: () => navigate(getTaskListHref({ assignee: "me" })),
    },
    {
      description: hasActiveProjects
        ? "Start a new work item in an active project"
        : "Activate a project before creating work",
      disabled: !hasActiveProjects,
      icon: PlusIcon,
      id: "new-work-item",
      keywords: ["create", "add", "task", "bug", "story"],
      label: "New Work Item",
      run: openNewWorkItem,
    },
  ];
}

function buildRepositoryCommandGroup({
  currentPathname,
  currentSearchParams,
  navigate,
}: Pick<
  BuildNavigationActionsOptions,
  "currentPathname" | "currentSearchParams" | "navigate"
>): CommandCenterGroup | null {
  const match = /^\/repos\/([^/]+)\/([^/]+)/.exec(currentPathname);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  const repositoryRoot = `/repos/${match[1]}/${match[2]}`;
  const rawVersionType = currentSearchParams.get("versionType");
  const versionType =
    rawVersionType === "commit" || rawVersionType === "tag"
      ? rawVersionType
      : "branch";
  const version = currentSearchParams.get("version");
  const versionSearch = version
    ? `?${new URLSearchParams({ version, versionType })}`
    : "";
  const destinations = [
    {
      description: "Browse repository files and README content",
      href: "",
      icon: Code2Icon,
      id: "repository-code",
      isActive:
        currentPathname === repositoryRoot ||
        currentPathname.startsWith(`${repositoryRoot}/tree`) ||
        currentPathname.startsWith(`${repositoryRoot}/blob`),
      keywords: ["blob", "code", "file", "readme", "tree"],
      label: "Repository code",
      shortcut: ["G", "C"],
    },
    {
      description: "Inspect branch and path commit history",
      href: "/commits",
      icon: Clock3Icon,
      id: "repository-commits",
      isActive: currentPathname.startsWith(`${repositoryRoot}/commits`),
      keywords: ["change", "commit", "diff", "history"],
      label: "Repository commits",
      shortcut: ["G", "H"],
    },
    {
      description: "Review repository pull requests",
      href: "/pulls",
      icon: GitPullRequestArrowIcon,
      id: "repository-pull-requests",
      isActive: currentPathname.startsWith(`${repositoryRoot}/pulls`),
      keywords: ["branch", "merge", "pr", "pull request"],
      label: "Repository pull requests",
      shortcut: ["G", "P"],
    },
    {
      description: "Follow Azure Git push and ref updates",
      href: "/activity",
      icon: UploadIcon,
      id: "repository-push-activity",
      isActive: currentPathname.startsWith(`${repositoryRoot}/activity`),
      keywords: ["activity", "branch", "push", "ref"],
      label: "Repository push activity",
      shortcut: ["G", "A"],
    },
    {
      description: "Search indexed code in this repository",
      href: "/search",
      icon: SearchIcon,
      id: "repository-search",
      isActive: currentPathname.startsWith(`${repositoryRoot}/search`),
      keywords: ["code", "find", "search", "symbol"],
      label: "Search repository code",
      shortcut: ["/"],
    },
  ] as const;

  return {
    actions: destinations.map((destination) => ({
      checked: destination.isActive,
      description: destination.description,
      icon: destination.icon,
      id: destination.id,
      keywords: destination.keywords,
      label: destination.label,
      run: () =>
        navigate(
          `${repositoryRoot}${destination.href}${versionSearch}`,
        ),
      shortcut: destination.shortcut,
    })),
    heading: "Current repository",
    id: "current-repository",
  };
}

function getSuggestedActionIds(currentPathname: string) {
  if (currentPathname === "/") {
    return ["your-queue", "new-work-item"];
  }

  if (currentPathname === "/tasks") {
    return ["home", "new-work-item"];
  }

  if (currentPathname.startsWith("/tasks/")) {
    return ["work-items", "new-work-item"];
  }

  return ["home", "work-items"];
}

export function parseDirectWorkItemId(search: string) {
  const match = search.trim().match(/^(?:#|work\s*item\s*)?(\d+)$/i);

  if (!match?.[1]) {
    return null;
  }

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function buildDirectWorkItemAction(
  search: string,
  navigate: (href: string) => void,
): CommandCenterAction | null {
  const workItemId = parseDirectWorkItemId(search);

  if (!workItemId) {
    return null;
  }

  return {
    description: "Open this work item by its Azure DevOps ID",
    icon: HashIcon,
    id: `work-item-${workItemId}`,
    keywords: ["id", "number", `#${workItemId}`],
    label: `Open work item #${workItemId}`,
    run: () => navigate(getTaskDetailHref(workItemId)),
    shortcut: ["↵"],
  };
}

function buildSecondaryViewActions({
  availableProjects,
  navigate,
  openView,
}: Pick<
  BuildRootCommandGroupsOptions,
  "availableProjects" | "navigate" | "openView"
>): CommandCenterAction[] {
  return [
    {
      description: "Open focused destinations for common work item views",
      icon: ListFilterIcon,
      id: "browse-filters",
      keepOpen: true,
      keywords: [
        "active",
        "bugs",
        "filter",
        "highest priority",
        "priority one",
        "unassigned",
      ],
      label: "Browse filters",
      nested: true,
      run: () => openView("filters"),
    },
    ...(availableProjects.length > 0
      ? [
          {
            description: "Choose the Azure DevOps projects in your workspace",
            icon: FolderKanbanIcon,
            id: "switch-projects",
            keepOpen: true,
            keywords: [
              "active",
              "project",
              "selection",
              "switch",
              "workspace",
              ...availableProjects.map((project) => project.name),
            ],
            label: "Switch active projects",
            nested: true,
            run: () => openView("projects"),
          },
        ]
      : []),
    {
      description: "Choose theme mode and visual style",
      icon: PaletteIcon,
      id: "change-appearance",
      keepOpen: true,
      keywords: [
        "appearance",
        "dark",
        "default",
        "light",
        "mono",
        "perpetuity",
        "style",
        "system",
        "theme",
      ],
      label: "Change appearance",
      nested: true,
      run: () => openView("appearance"),
    },
    {
      description: "Browse code across active Azure DevOps projects",
      icon: FolderGit2Icon,
      id: "repositories",
      keywords: ["azure repos", "code", "git", "repository"],
      label: "Repositories",
      run: () => navigate("/repos"),
    },
  ];
}

export function buildFilterCommandGroups(
  navigate: (href: string) => void,
): CommandCenterGroup[] {
  return [
    {
      actions: FILTER_DESTINATIONS.map((destination) => ({
        description: destination.description,
        icon: destination.icon,
        id: destination.id,
        keywords: destination.keywords,
        label: destination.label,
        run: () => navigate(getTaskListHref(destination.filters)),
      })),
      heading: "Common filters",
      id: "filters",
    },
  ];
}

export function buildRootCommandGroups(
  options: BuildRootCommandGroupsOptions,
): CommandCenterGroup[] {
  const navigationActions = buildNavigationActions(options);
  const suggestedActionIds = new Set(
    getSuggestedActionIds(options.currentPathname),
  );
  const suggestedActions = navigationActions.filter((action) =>
    suggestedActionIds.has(action.id)
  );
  const commandActions = [
    ...navigationActions.filter(
      (action) => !suggestedActionIds.has(action.id),
    ),
    ...buildSecondaryViewActions(options),
  ];
  const repositoryGroup = buildRepositoryCommandGroup(options);

  return [
    {
      actions: suggestedActions,
      heading: "Suggestions",
      id: "suggestions",
    },
    ...(repositoryGroup ? [repositoryGroup] : []),
    {
      actions: commandActions,
      heading: "Commands",
      id: "commands",
    },
  ];
}
