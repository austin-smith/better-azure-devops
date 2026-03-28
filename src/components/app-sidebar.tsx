"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CircleDotIcon,
  FolderGit2Icon,
  LayoutListIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { TaskView } from "@/lib/azure-devops/tasks";
import {
  getTaskViewHref,
  parseOptionalTaskView,
  TASK_VIEW_OPTIONS,
} from "@/lib/tasks/navigation";

type AppSidebarProps = {
  orgLabel: string;
  projectLabel: string;
};

function avatarFallback(label: string) {
  return (
    label
      .split(" ")
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "??"
  );
}

export function AppSidebar({
  orgLabel,
  projectLabel,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailView = parseOptionalTaskView(searchParams.get("view"));
  const selectedView: TaskView = pathname === "/mine"
    ? "mine"
    : pathname.startsWith("/tasks/")
      ? detailView ?? "all"
      : "all";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={projectLabel}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <LayoutListIcon />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{projectLabel}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {orgLabel}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {TASK_VIEW_OPTIONS.map((view) => {
                const Icon = CircleDotIcon;

                return (
                  <SidebarMenuItem key={view.id}>
                    <SidebarMenuButton
                      render={<Link href={getTaskViewHref(view.id)} />}
                      isActive={view.id === selectedView}
                      tooltip={view.label}
                    >
                      <Icon />
                      <span>{view.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Project</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={getTaskViewHref(selectedView)} />}
                  tooltip={projectLabel}
                >
                  <FolderGit2Icon />
                  <span>{projectLabel}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={orgLabel}>
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {avatarFallback(orgLabel)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{orgLabel}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  Azure DevOps org
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
