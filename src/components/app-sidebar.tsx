"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import {
  getTaskViewHref,
  getTaskViewSlugFromPathname,
} from "@/lib/tasks/navigation";
import type { TaskViewDefinition } from "@/lib/tasks/views";

type AppSidebarProps = {
  orgLabel: string;
  projectLabel: string;
  views: ReadonlyArray<TaskViewDefinition>;
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
  views,
}: AppSidebarProps) {
  const pathname = usePathname();
  const defaultView = views[0];
  const selectedViewSlug = getTaskViewSlugFromPathname(pathname);
  const selectedView = views.find((view) => view.slug === selectedViewSlug) ?? null;

  if (!defaultView) {
    return null;
  }

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
              {views.map((view) => {
                const Icon = CircleDotIcon;

                return (
                  <SidebarMenuItem key={view.slug}>
                    <SidebarMenuButton
                      render={<Link href={getTaskViewHref(view.slug)} />}
                      isActive={view.slug === selectedViewSlug}
                      tooltip={view.label}
                    >
                      <Icon />
                      <span>{view.shortLabel}</span>
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
                  render={<Link href={getTaskViewHref((selectedView ?? defaultView).slug)} />}
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
