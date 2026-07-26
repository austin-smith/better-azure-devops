"use client";

import {
  createContext,
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CommandIcon,
  SearchXIcon,
} from "lucide-react";
import { buildAppearanceCommandGroups } from "@/components/command-center/appearance-command-registry";
import {
  buildDirectWorkItemAction,
  buildFilterCommandGroups,
  buildRootCommandGroups,
  type CommandCenterAction,
  type CommandCenterGroup,
  type CommandCenterProject,
  type CommandCenterView,
} from "@/components/command-center/command-registry";
import { buildProjectCommandGroups } from "@/components/command-center/project-command-registry";
import { ProjectImage } from "@/components/project-image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/themes/theme-provider";
import { parseTaskListUrlSearchParams } from "@/lib/tasks/filters";
import { getProjectSelectionHref } from "@/lib/tasks/navigation";
import { useThemeFamily } from "@/hooks/use-theme-family";

type CommandCenterContextValue = {
  openCommandCenter: () => void;
};

type CommandCenterProviderProps = {
  availableProjects: readonly CommandCenterProject[];
  children: ReactNode;
  selectedProjectIds: readonly string[];
};

type ProjectSelectionPayload = {
  availableProjects: CommandCenterProject[];
  selectedProjectIds: string[];
};

type CommandViewDetails = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  label: string;
  placeholder: string;
};

const COMMAND_VIEW_DETAILS: Record<CommandCenterView, CommandViewDetails> = {
  root: {
    description:
      "Search navigation, work items, projects, filters, and appearance.",
    emptyDescription:
      "Try a page, project, filter, appearance option, or numeric work item ID.",
    emptyTitle: "No matching commands",
    label: "Command center",
    placeholder: "Search commands or enter a work item ID...",
  },
  filters: {
    description: "Search focused destinations for common work item filters.",
    emptyDescription: "Try active, bugs, priority, or unassigned.",
    emptyTitle: "No matching filters",
    label: "Filters",
    placeholder: "Search filters or enter a work item ID...",
  },
  projects: {
    description: "Search and switch the Azure DevOps projects in your workspace.",
    emptyDescription: "Try the name of an Azure DevOps project.",
    emptyTitle: "No matching projects",
    label: "Active projects",
    placeholder: "Search projects or enter a work item ID...",
  },
  appearance: {
    description: "Search and change the command center appearance.",
    emptyDescription: "Try light, dark, system, default, mono, or perpetuity.",
    emptyTitle: "No matching appearance options",
    label: "Appearance",
    placeholder: "Search appearance or enter a work item ID...",
  },
};

const ROOT_ACTION_ID_BY_VIEW: Record<
  Exclude<CommandCenterView, "root">,
  string
> = {
  appearance: "change-appearance",
  filters: "browse-filters",
  projects: "switch-projects",
};

const CommandCenterContext = createContext<CommandCenterContextValue>({
  openCommandCenter: () => {},
});

function isProject(value: unknown): value is CommandCenterProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const project = value as Record<string, unknown>;

  return (
    typeof project.id === "string" &&
    typeof project.name === "string" &&
    (typeof project.defaultTeamImageUrl === "string" ||
      project.defaultTeamImageUrl === null)
  );
}

function parseProjectSelectionPayload(
  value: unknown,
  fallbackProjects: readonly CommandCenterProject[],
  fallbackProjectIds: readonly string[],
): ProjectSelectionPayload {
  if (!value || typeof value !== "object") {
    return {
      availableProjects: [...fallbackProjects],
      selectedProjectIds: [...fallbackProjectIds],
    };
  }

  const payload = value as Record<string, unknown>;
  const availableProjects = Array.isArray(payload.availableProjects)
    ? payload.availableProjects.filter(isProject)
    : [...fallbackProjects];
  const selectedProjectIds = Array.isArray(payload.selectedProjectIds)
    ? payload.selectedProjectIds.filter(
        (projectId): projectId is string => typeof projectId === "string",
      )
    : [...fallbackProjectIds];

  return {
    availableProjects,
    selectedProjectIds,
  };
}

function getErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = (value as Record<string, unknown>).error;
  return typeof error === "string" && error.trim() ? error : null;
}

function getActionKeywords(action: CommandCenterAction) {
  return [
    action.label,
    action.description,
    ...action.keywords,
  ];
}

function filterCommandGroups(
  groups: readonly CommandCenterGroup[],
  search: string,
) {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  if (terms.length === 0) {
    return groups;
  }

  return groups
    .map((group) => ({
      ...group,
      actions: group.actions.filter((action) => {
        const searchableText = getActionKeywords(action)
          .join(" ")
          .toLocaleLowerCase();

        return terms.every((term) => searchableText.includes(term));
      }),
    }))
    .filter((group) => group.actions.length > 0);
}

function CommandActionItem({
  action,
  onRun,
}: {
  action: CommandCenterAction;
  onRun: (action: CommandCenterAction) => void;
}) {
  const Icon = action.icon;
  const accessibleLabel = [
    action.label,
    action.description,
    action.checked ? "Current" : null,
  ].filter(Boolean).join(". ");

  return (
    <CommandItem
      aria-label={accessibleLabel}
      className="py-2"
      data-checked={action.checked ? "true" : undefined}
      disabled={action.disabled}
      keywords={getActionKeywords(action)}
      onSelect={() => onRun(action)}
      value={action.id}
    >
      {action.project ? (
        <ProjectImage
          imageUrl={action.project.defaultTeamImageUrl}
          name={action.project.name}
          size="sm"
        />
      ) : Icon ? (
        <Icon />
      ) : (
        <CommandIcon />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{action.label}</span>
        <span className="truncate text-xs text-muted-foreground">
          {action.description}
        </span>
      </span>
      {action.shortcut ? (
        <CommandShortcut>
          <KbdGroup>
            {action.shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </KbdGroup>
        </CommandShortcut>
      ) : action.nested ? (
        <CommandShortcut aria-hidden="true">
          <ChevronRightIcon className="size-4" />
        </CommandShortcut>
      ) : null}
    </CommandItem>
  );
}

function CommandGroups({
  groups,
  onRun,
}: {
  groups: readonly CommandCenterGroup[];
  onRun: (action: CommandCenterAction) => void;
}) {
  return groups.map((group, index) => (
    <Fragment key={group.id}>
      {index > 0 ? <CommandSeparator /> : null}
      <CommandGroup heading={group.heading}>
        {group.actions.map((action) => (
          <CommandActionItem action={action} key={action.id} onRun={onRun} />
        ))}
      </CommandGroup>
    </Fragment>
  ));
}

function CommandCenterDialog({
  availableProjects,
  onOpenChange,
  open,
  selectedProjectIds,
}: {
  availableProjects: readonly CommandCenterProject[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedProjectIds: readonly string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTheme, theme } = useTheme();
  const { setThemeFamily, themeFamily } = useThemeFamily();
  const inputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState([...availableProjects]);
  const [projectIds, setProjectIds] = useState([...selectedProjectIds]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [savingProjectId, setSavingProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedActionValue, setSelectedActionValue] = useState("");
  const [view, setView] = useState<CommandCenterView>("root");

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setProjectError(null);
      setSearch("");
      setSelectedActionValue("");
      setView("root");
    }

    onOpenChange(nextOpen);
  }, [onOpenChange]);

  useEffect(() => {
    setProjects([...availableProjects]);
  }, [availableProjects]);

  useEffect(() => {
    setProjectIds([...selectedProjectIds]);
  }, [selectedProjectIds]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      handleOpenChange(!open);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenChange, open]);

  const navigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const openNewWorkItem = useCallback(() => {
    const url = new URL(window.location.href);

    if (url.pathname !== "/tasks") {
      url.pathname = "/tasks";
      url.search = "";
    }

    url.searchParams.set("newWorkItem", String(Date.now()));
    navigate(`${url.pathname}${url.search}`);
  }, [navigate]);

  const selectView = useCallback((nextView: CommandCenterView) => {
    setSelectedActionValue(
      nextView === "root" && view !== "root"
        ? ROOT_ACTION_ID_BY_VIEW[view]
        : "",
    );
    setView(nextView);
    setSearch("");
  }, [view]);

  const cycleView = useCallback((direction: 1 | -1) => {
    const views: readonly CommandCenterView[] =
      projects.length > 0
        ? ["root", "filters", "projects", "appearance"]
        : ["root", "filters", "appearance"];
    const currentIndex = views.indexOf(view);
    const nextIndex =
      (currentIndex + direction + views.length) % views.length;

    selectView(views[nextIndex] ?? "root");
  }, [projects.length, selectView, view]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open, view]);

  const toggleProject = useCallback(async (projectId: string) => {
    if (savingProjectId) {
      return;
    }

    const previousProjectIds = [...projectIds];
    const nextProjectIds = projectIds.includes(projectId)
      ? projectIds.filter((id) => id !== projectId)
      : [...projectIds, projectId];

    setProjectError(null);
    setProjectIds(nextProjectIds);
    setSavingProjectId(projectId);

    try {
      const response = await fetch("/api/projects/selection", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectIds: nextProjectIds,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload) ?? "Failed to update active projects.",
        );
      }

      const selection = parseProjectSelectionPayload(
        payload,
        projects,
        nextProjectIds,
      );

      setProjects(selection.availableProjects);
      setProjectIds(selection.selectedProjectIds);
      const currentUrl = new URL(window.location.href);
      const currentHref = `${currentUrl.pathname}${currentUrl.search}`;
      const nextHref = getProjectSelectionHref(
        currentUrl.pathname,
        currentUrl.search,
      );

      if (nextHref !== currentHref) {
        router.replace(nextHref);
      }

      router.refresh();
    } catch (error) {
      setProjectIds(previousProjectIds);
      setProjectError(
        error instanceof Error
          ? error.message
          : "Failed to update active projects.",
      );
    } finally {
      setSavingProjectId(null);
    }
  }, [projectIds, projects, router, savingProjectId]);

  const appearanceGroups = useMemo(
    () =>
      buildAppearanceCommandGroups({
        setThemeFamily,
        setThemeMode: setTheme,
        themeFamily,
        themeMode: theme,
      }),
    [setTheme, setThemeFamily, theme, themeFamily],
  );
  const currentTaskFilters = useMemo(
    () => parseTaskListUrlSearchParams(searchParams),
    [searchParams],
  );
  const filterGroups = useMemo(
    () => buildFilterCommandGroups(navigate),
    [navigate],
  );
  const projectGroups = useMemo(
    () =>
      buildProjectCommandGroups({
        availableProjects: projects,
        selectedProjectIds: projectIds,
        toggleProject,
      }).map((group) => ({
        ...group,
        actions: group.actions.map((action) => ({
          ...action,
          disabled: savingProjectId !== null,
        })),
      })),
    [projectIds, projects, savingProjectId, toggleProject],
  );
  const rootGroups = useMemo(
    () =>
      buildRootCommandGroups({
        availableProjects: projects,
        currentPathname: pathname,
        currentSearchParams: searchParams,
        currentTaskFilters,
        hasActiveProjects: projectIds.length > 0,
        navigate,
        openNewWorkItem,
        openView: selectView,
      }),
    [
      currentTaskFilters,
      navigate,
      openNewWorkItem,
      pathname,
      projectIds.length,
      projects,
      searchParams,
      selectView,
    ],
  );
  const groups = useMemo(() => {
    if (view === "filters") {
      return filterGroups;
    }

    if (view === "projects") {
      return projectGroups;
    }

    if (view === "appearance") {
      return appearanceGroups;
    }

    return rootGroups;
  }, [
    appearanceGroups,
    filterGroups,
    projectGroups,
    rootGroups,
    view,
  ]);
  const directWorkItemAction = useMemo(
    () => buildDirectWorkItemAction(search, navigate),
    [navigate, search],
  );
  const visibleGroups = useMemo(
    () => filterCommandGroups(groups, search),
    [groups, search],
  );
  const selectedAction = useMemo(() => {
    const actions = [
      ...(directWorkItemAction ? [directWorkItemAction] : []),
      ...visibleGroups.flatMap((group) => group.actions),
    ];

    return actions.find(
      (action) => action.id === selectedActionValue,
    ) ?? null;
  }, [directWorkItemAction, selectedActionValue, visibleGroups]);
  const viewDetails = COMMAND_VIEW_DETAILS[view];
  const searchLabel =
    view === "root"
      ? "Search commands"
      : `Search ${viewDetails.label.toLowerCase()}`;

  function runAction(action: CommandCenterAction) {
    if (!action.keepOpen) {
      handleOpenChange(false);
    }

    void action.run();
  }

  return (
    <CommandDialog
      className="top-[10svh] sm:max-w-2xl"
      description={viewDetails.description}
      onOpenChange={handleOpenChange}
      open={open}
      title="Command center"
    >
      <Command
        label={searchLabel}
        onValueChange={setSelectedActionValue}
        shouldFilter={false}
        value={selectedActionValue}
      >
        <div className="flex items-center">
          {view !== "root" ? (
            <Button
              aria-label="Back to commands"
              className="ml-1"
              onClick={() => selectView("root")}
              size="icon"
              variant="ghost"
            >
              <ArrowLeftIcon />
            </Button>
          ) : null}
          <div className="min-w-0 flex-1">
            <CommandInput
              aria-label={searchLabel}
              onKeyDown={(event) => {
                if (
                  event.key === "ArrowLeft" &&
                  view !== "root" &&
                  search.length === 0
                ) {
                  event.preventDefault();
                  selectView("root");
                  return;
                }

                if (
                  event.key === "ArrowRight" &&
                  view === "root" &&
                  search.length === 0 &&
                  selectedAction?.nested
                ) {
                  event.preventDefault();
                  runAction(selectedAction);
                  return;
                }

                if (event.key !== "Tab") {
                  return;
                }

                event.preventDefault();
                cycleView(event.shiftKey ? -1 : 1);
              }}
              onValueChange={(nextSearch) => {
                setSelectedActionValue("");
                setSearch(nextSearch);
              }}
              placeholder={viewDetails.placeholder}
              ref={inputRef}
              value={search}
            />
          </div>
        </div>

        <Separator />
        <CommandList
          className="h-[min(60svh,24rem)] max-h-none"
          key={view}
        >
          <CommandEmpty>
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>{viewDetails.emptyTitle}</EmptyTitle>
                <EmptyDescription>
                  {viewDetails.emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CommandEmpty>

          {directWorkItemAction ? (
            <>
              <CommandGroup heading="Work item">
                <CommandActionItem
                  action={directWorkItemAction}
                  onRun={runAction}
                />
              </CommandGroup>
              <CommandSeparator />
            </>
          ) : null}

          <CommandGroups groups={visibleGroups} onRun={runAction} />
        </CommandList>

        {projectError ? (
          <Alert className="mx-2 mb-2" variant="destructive">
            <AlertDescription>{projectError}</AlertDescription>
          </Alert>
        ) : null}

        <Separator />
        <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </KbdGroup>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <KbdGroup>
                <Kbd>↵</Kbd>
              </KbdGroup>
              <span>Open</span>
            </span>
            {view === "root" ? (
              <span className="hidden items-center gap-1.5 sm:flex">
                <KbdGroup>
                  <Kbd>→</Kbd>
                </KbdGroup>
                <span>Drill in</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <KbdGroup>
                  <Kbd>←</Kbd>
                </KbdGroup>
                <span>Back</span>
              </span>
            )}
            <span className="hidden items-center gap-1.5 sm:flex">
              <KbdGroup>
                <Kbd>Esc</Kbd>
              </KbdGroup>
              <span>Close</span>
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <KbdGroup>
              <Kbd>Tab</Kbd>
            </KbdGroup>
            <span>Switch</span>
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}

export function CommandCenterProvider({
  availableProjects,
  children,
  selectedProjectIds,
}: CommandCenterProviderProps) {
  const [open, setOpen] = useState(false);
  const openCommandCenter = useCallback(() => setOpen(true), []);

  const contextValue = useMemo(
    () => ({ openCommandCenter }),
    [openCommandCenter],
  );

  return (
    <CommandCenterContext.Provider value={contextValue}>
      {children}
      <CommandCenterDialog
        availableProjects={availableProjects}
        onOpenChange={setOpen}
        open={open}
        selectedProjectIds={selectedProjectIds}
      />
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter() {
  return useContext(CommandCenterContext);
}
