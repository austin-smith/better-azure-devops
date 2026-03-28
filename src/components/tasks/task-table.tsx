"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDownIcon, FilterIcon, PlusIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppHeader } from "@/components/app-header";
import type {
  AzureDevOpsTask as Task,
  TaskView,
} from "@/lib/azure-devops/tasks";
import {
  getTaskDetailHref,
  getTaskViewLabel,
} from "@/lib/tasks/navigation";

type TaskTableProps = {
  error: string | null;
  items: Task[];
  projectLabel: string;
  view: TaskView;
};

function statusVariant(state: string) {
  switch (state.toLowerCase()) {
    case "done":
    case "closed":
    case "completed":
      return "secondary";
    case "blocked":
      return "destructive";
    default:
      return "outline";
  }
}

const columnHelper = createColumnHelper<Task>();

function getColumns(taskDetailHref: (taskId: number) => string) {
  return [
    columnHelper.accessor("id", {
      header: "ID",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          #{getValue()}
        </span>
      ),
    }),
    columnHelper.accessor("title", {
      header: "Title",
      cell: ({ getValue }) => (
        <div className="font-medium whitespace-normal">{getValue()}</div>
      ),
    }),
    columnHelper.accessor("state", {
      header: "State",
      cell: ({ getValue }) => (
        <div className="whitespace-nowrap">
          <Badge variant={statusVariant(getValue())}>{getValue()}</Badge>
        </div>
      ),
    }),
    columnHelper.accessor("priority", {
      header: "Priority",
      cell: ({ getValue }) => (
        <div className="whitespace-nowrap">
          <PriorityBadge priority={getValue()} />
        </div>
      ),
    }),
    columnHelper.accessor("assignee", {
      header: "Assignee",
      cell: ({ getValue, row }) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href={taskDetailHref(row.original.id)}
                className="relative z-20 inline-flex"
              >
                <UserAvatar
                  avatarUrl={row.original.assigneeAvatarUrl}
                  name={getValue()}
                  size="sm"
                />
              </Link>
            }
          />
          <TooltipContent>{getValue()}</TooltipContent>
        </Tooltip>
      ),
    }),
    columnHelper.accessor("updatedAt", {
      header: "Updated",
      cell: ({ getValue }) => (
        <DateLabel
          className="whitespace-nowrap text-muted-foreground"
          value={getValue()}
        />
      ),
    }),
  ];
}

export function TaskTable({
  error,
  items,
  projectLabel,
  view,
}: TaskTableProps) {
  const taskDetailHref = (taskId: number) => getTaskDetailHref(taskId, view);
  const columns = getColumns(taskDetailHref);

  // TanStack Table manages imperative table state internally and is not React Compiler-compatible.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  return (
    <>
      <AppHeader
        actions={(
          <>
            <ThemeToggle />
            <Button variant="outline" size="sm">
              <FilterIcon data-icon="inline-start" />
              <span>Filter</span>
            </Button>
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              <span>New Task</span>
            </Button>
          </>
        )}
        items={[
          { href: "/", label: projectLabel },
          { label: getTaskViewLabel(view) },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="min-w-64 flex-1" placeholder="Search tasks" type="search" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">
              Status
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="sm">
              Assignee
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
            <Button variant="outline" size="sm">
              Iteration
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background">
          <div className="h-full overflow-auto">
            <Table className="text-sm">
              <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      className="px-4 py-8 text-muted-foreground"
                      colSpan={columns.length}
                    >
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="cursor-pointer align-top">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="relative">
                          <Link
                            aria-hidden={cell.column.id !== "id"}
                            href={taskDetailHref(row.original.id)}
                            tabIndex={cell.column.id === "id" ? 0 : -1}
                            className="absolute inset-0 z-0"
                          >
                            <span className="sr-only">
                              Open task #{row.original.id}
                            </span>
                          </Link>
                          <div
                            className={
                              cell.column.id === "assignee"
                                ? "relative z-10"
                                : "pointer-events-none relative z-10"
                            }
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
