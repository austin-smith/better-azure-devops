"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  HouseIcon,
  LayoutListIcon,
  UserCircle2Icon,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
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

type AppSidebarProps = {
  currentUser: {
    avatarUrl: string | null;
    email: string | null;
    name: string;
  } | null;
  queueCount: number | null;
  taskCount: number | null;
  orgLabel: string;
  projectLabel: string;
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

export function AppSidebar({
  currentUser,
  queueCount,
  taskCount,
  orgLabel,
  projectLabel,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={projectLabel}
              render={<Link href="/" />}
            >
              <Image
                alt=""
                className="size-8 rounded-lg object-cover"
                height={32}
                src="/logo.png"
                width={32}
              />
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
