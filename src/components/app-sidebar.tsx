"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDownIcon,
  FolderIcon,
  HouseIcon,
  LayoutListIcon,
  Loader2Icon,
  UserCircle2Icon,
} from "lucide-react";
import { ProjectImage } from "@/components/project-image";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenuCheckboxItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuBadge,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  getDefaultTaskListHref,
  getTaskListHref,
} from "@/lib/tasks/navigation";
import type { AzureDevOpsProject } from "@/lib/azure-devops/projects";

type ProjectOption = Pick<AzureDevOpsProject, "defaultTeamImageUrl" | "id" | "name">;

type AppSidebarProps = {
  currentUser: {
    avatarUrl: string | null;
    email: string | null;
    name: string;
  } | null;
  availableProjects: readonly ProjectOption[];
  queueCount: number | null;
  selectedProjectIds: readonly string[];
  taskCount: number | null;
  orgLabel: string;
};

type SidebarNavigationProps = Pick<AppSidebarProps, "queueCount" | "taskCount">;

function SidebarNavigation({
  queueCount,
  taskCount,
}: SidebarNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === "/";
  const isTaskRoute = pathname === "/tasks" || pathname.startsWith("/tasks/");
  const isQueue = isTaskRoute && searchParams.get("assignee") === "me";
  const isTasks = isTaskRoute && !isQueue;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href="/" />}
          isActive={isHome}
          tooltip="Home"
        >
          <HouseIcon />
          <span>Home</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={getDefaultTaskListHref()} />}
          isActive={isTasks}
          tooltip="Work Items"
        >
          <LayoutListIcon />
          <span>Work Items</span>
        </SidebarMenuButton>
        {taskCount !== null ? (
          <SidebarMenuBadge>{taskCount}</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={getTaskListHref({ assignee: "me" })} />}
          isActive={isQueue}
          tooltip="Your Queue"
        >
          <UserCircle2Icon />
          <span>Your Queue</span>
        </SidebarMenuButton>
        {queueCount !== null ? (
          <SidebarMenuBadge>{queueCount}</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function SidebarNavigationFallback({
  queueCount,
  taskCount,
}: SidebarNavigationProps) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href="/" />}
          tooltip="Home"
        >
          <HouseIcon />
          <span>Home</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={getDefaultTaskListHref()} />}
          tooltip="Work Items"
        >
          <LayoutListIcon />
          <span>Work Items</span>
        </SidebarMenuButton>
        {taskCount !== null ? (
          <SidebarMenuBadge>{taskCount}</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link href={getTaskListHref({ assignee: "me" })} />}
          tooltip="Your Queue"
        >
          <UserCircle2Icon />
          <span>Your Queue</span>
        </SidebarMenuButton>
        {queueCount !== null ? (
          <SidebarMenuBadge>{queueCount}</SidebarMenuBadge>
        ) : null}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function toggleSelection(values: readonly string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function areSelectionsEqual(
  left: readonly string[],
  right: readonly string[],
) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function getProjectsLabel(
  selectedProjectIds: readonly string[],
  availableProjects: readonly ProjectOption[],
) {
  if (selectedProjectIds.length === 0) {
    return "Projects";
  }

  if (selectedProjectIds.length === 1) {
    return (
      availableProjects.find((project) => project.id === selectedProjectIds[0])?.name ??
      "Projects"
    );
  }

  return `Projects (${selectedProjectIds.length})`;
}

function findProjectById(
  availableProjects: readonly ProjectOption[],
  projectId: string | null,
) {
  return projectId
    ? availableProjects.find((project) => project.id === projectId) ?? null
    : null;
}

function ActiveProjectsControl({
  availableProjects: initialAvailableProjects,
  selectedProjectIds: initialSelectedProjectIds,
}: Pick<AppSidebarProps, "availableProjects" | "selectedProjectIds">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [availableProjects, setAvailableProjects] = useState([...initialAvailableProjects]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([...initialSelectedProjectIds]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingProjects, setIsSavingProjects] = useState(false);
  const [isPending, startTransition] = useTransition();
  const latestSelectedProjectIdsRef = useRef([...initialSelectedProjectIds]);
  const savedProjectIdsRef = useRef([...initialSelectedProjectIds]);
  const pendingProjectIdsRef = useRef<string[] | null>(null);
  const isSavingProjectsRef = useRef(false);
  const selectedProject =
    selectedProjectIds.length === 1
      ? findProjectById(availableProjects, selectedProjectIds[0] ?? null)
      : null;

  useEffect(() => {
    setAvailableProjects([...initialAvailableProjects]);
  }, [initialAvailableProjects]);

  useEffect(() => {
    const nextSelectedProjectIds = [...initialSelectedProjectIds];
    savedProjectIdsRef.current = nextSelectedProjectIds;

    if (isSavingProjectsRef.current || pendingProjectIdsRef.current) {
      return;
    }

    latestSelectedProjectIdsRef.current = nextSelectedProjectIds;
    setSelectedProjectIds(nextSelectedProjectIds);
  }, [initialSelectedProjectIds]);

  function buildNextHref() {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("areaPath");
    nextSearchParams.delete("iterationPath");
    nextSearchParams.delete("project");

    const query = nextSearchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  async function flushProjectSelection() {
    if (isSavingProjectsRef.current) {
      return;
    }

    isSavingProjectsRef.current = true;
    setIsSavingProjects(true);

    let shouldRefresh = false;

    try {
      while (pendingProjectIdsRef.current) {
        const nextProjectIds = pendingProjectIdsRef.current;
        pendingProjectIdsRef.current = null;

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
          const payload = (await response.json()) as
            | {
                availableProjects?: ProjectOption[];
                error?: string;
                selectedProjectIds?: string[];
              }
            | undefined;

          if (!response.ok) {
            throw new Error(payload?.error ?? "Failed to update projects.");
          }

          const confirmedProjectIds = payload?.selectedProjectIds ?? nextProjectIds;

          setAvailableProjects([...(payload?.availableProjects ?? initialAvailableProjects)]);
          savedProjectIdsRef.current = [...confirmedProjectIds];
          shouldRefresh = true;

          if (areSelectionsEqual(latestSelectedProjectIdsRef.current, nextProjectIds)) {
            latestSelectedProjectIdsRef.current = [...confirmedProjectIds];
            setSelectedProjectIds(confirmedProjectIds);
          }
        } catch (error) {
          const rollbackProjectIds = [...savedProjectIdsRef.current];

          pendingProjectIdsRef.current = null;
          latestSelectedProjectIdsRef.current = rollbackProjectIds;
          setSelectedProjectIds(rollbackProjectIds);
          setSaveError(error instanceof Error ? error.message : "Failed to update projects.");
          return;
        }
      }

      setSaveError(null);
    } finally {
      isSavingProjectsRef.current = false;
      setIsSavingProjects(false);
    }

    if (shouldRefresh) {
      startTransition(() => {
        router.replace(buildNextHref());
        router.refresh();
      });
    }
  }

  function handleProjectToggle(projectId: string) {
    setSaveError(null);

    const nextProjectIds = toggleSelection(latestSelectedProjectIdsRef.current, projectId);

    latestSelectedProjectIdsRef.current = nextProjectIds;
    pendingProjectIdsRef.current = nextProjectIds;
    setSelectedProjectIds(nextProjectIds);

    void flushProjectSelection();
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <SidebarMenuButton
                className="group-data-[collapsible=icon]:justify-center"
                tooltip={getProjectsLabel(selectedProjectIds, availableProjects)}
                render={<DropdownMenuTrigger />}
              >
                {selectedProject ? (
                  <ProjectImage
                    imageUrl={selectedProject.defaultTeamImageUrl}
                    name={selectedProject.name}
                    size="sm"
                  />
                ) : (
                  <FolderIcon className="hidden group-data-[collapsible=icon]:block" />
                )}
                <span className="group-data-[collapsible=icon]:hidden">
                  {getProjectsLabel(selectedProjectIds, availableProjects)}
                </span>
                {isSavingProjects || isPending ? (
                  <Loader2Icon className="ml-auto size-4 animate-spin group-data-[collapsible=icon]:hidden" />
                ) : (
                  <ChevronDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                )}
              </SidebarMenuButton>
              <DropdownMenuContent align="end" className="min-w-60">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Active projects</DropdownMenuLabel>
                  {availableProjects.map((project) => (
                    <DropdownMenuCheckboxItem
                      key={project.id}
                      checked={selectedProjectIds.includes(project.id)}
                      onClick={() => {
                        handleProjectToggle(project.id);
                      }}
                    >
                      <ProjectImage
                        imageUrl={project.defaultTeamImageUrl}
                        name={project.name}
                        size="sm"
                      />
                      <span className="truncate">{project.name}</span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuGroup>
                {saveError ? (
                  <div className="border-t px-3 py-2 text-xs text-destructive">{saveError}</div>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar({
  availableProjects,
  currentUser,
  queueCount,
  selectedProjectIds,
  taskCount,
  orgLabel,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-12 border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={orgLabel}
              render={<Link href="/" />}
            >
              <Image
                alt=""
                className="size-8 rounded-lg object-cover"
                height={32}
                src="/logo.png"
                width={32}
              />
              <span className="truncate font-medium">{orgLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <ActiveProjectsControl
          availableProjects={availableProjects}
          selectedProjectIds={selectedProjectIds}
        />

        <SidebarSeparator className="mx-0" />

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <Suspense
              fallback={
                <SidebarNavigationFallback
                  queueCount={queueCount}
                  taskCount={taskCount}
                />
              }
            >
              <SidebarNavigation
                queueCount={queueCount}
                taskCount={taskCount}
              />
            </Suspense>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {currentUser ? (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <SidebarMenuButton
                  size="lg"
                  tooltip={currentUser.name}
                  render={<DropdownMenuTrigger />}
                >
                  <UserAvatar
                    avatarUrl={currentUser.avatarUrl}
                    name={currentUser.name}
                  />
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{currentUser.name}</span>
                  </div>
                </SidebarMenuButton>
                <DropdownMenuContent
                  align="end"
                  className="w-64 min-w-64 p-0"
                  side="top"
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <UserAvatar
                      avatarUrl={currentUser.avatarUrl}
                      name={currentUser.name}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {currentUser.name}
                      </div>
                      {currentUser.email ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {currentUser.email}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                    {orgLabel}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}

      <SidebarRail />
    </Sidebar>
  );
}
