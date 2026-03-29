"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  AzureDevOpsClassificationPathOption,
  AzureDevOpsAssigneeOption,
  AzureDevOpsTask as Task,
} from "@/lib/azure-devops/tasks";
import {
  getTaskListHref,
  getTaskDetailHref,
} from "@/lib/tasks/navigation";
import {
  getCompactTaskPathBreadcrumb,
  getDefaultTaskListFilters,
  isTaskListFiltered,
  type TaskFilterOptions,
  type TaskListFilters,
} from "@/lib/tasks/filters";
import { getTaskStateBadgeVariant } from "@/lib/tasks/state";

type TaskTableProps = {
  error: string | null;
  filterOptions: TaskFilterOptions;
  filters: TaskListFilters;
  items: Task[];
  title: string;
};

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
          <Badge variant={getTaskStateBadgeVariant(getValue())}>{getValue()}</Badge>
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

function toggleSelection(values: readonly string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function getFilterTriggerClassName(isActive: boolean) {
  return cn(
    buttonVariants({ size: "sm", variant: "outline" }),
    isActive &&
      "border-foreground/40 ring-1 ring-inset ring-foreground/15 hover:border-foreground/50 aria-expanded:border-foreground/50",
  );
}

type AssigneeFilterProps = {
  currentAssignee: string | null;
  disabled?: boolean;
  onChange: (assignee: string | null) => void;
};

function AssigneeFilter({
  currentAssignee,
  disabled = false,
  onChange,
}: AssigneeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AzureDevOpsAssigneeOption[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const showResults = results.length > 0;
  const showEmpty = !isLoading && query.trim().length >= 2 && results.length === 0;
  const showList = isLoading || Boolean(lookupError) || showResults || showEmpty;

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setLookupError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      setLookupError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setLookupError(null);

      try {
        const response = await fetch(
          `/api/assignees?q=${encodeURIComponent(trimmedQuery)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as
          | {
              error?: string;
              items?: AzureDevOpsAssigneeOption[];
            }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load assignees.");
        }

        setResults(payload?.items ?? []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setLookupError(
          error instanceof Error ? error.message : "Failed to load assignees.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, query]);

  function selectAssignee(assignee: string | null) {
    onChange(assignee);
    setIsOpen(false);
  }

  return (
    <Popover
      modal={false}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger
        className={getFilterTriggerClassName(currentAssignee !== null)}
        disabled={disabled}
      >
        Assignee
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 min-w-72 overflow-hidden p-0"
        sideOffset={6}
      >
        <Command className="bg-transparent p-0" shouldFilter={false}>
          <CommandInput
            autoFocus
            disabled={disabled}
            onValueChange={setQuery}
            placeholder="Search assignee"
            value={query}
          />
          <CommandList className="max-h-72">
            <CommandGroup heading="Filters">
              <CommandItem
                data-checked={currentAssignee === null}
                onSelect={() => selectAssignee(null)}
                value="__all"
              >
                Anyone
              </CommandItem>
              <CommandItem
                data-checked={currentAssignee === "me"}
                onSelect={() => selectAssignee("me")}
                value="me"
              >
                Assigned to me
              </CommandItem>
              <CommandItem
                data-checked={currentAssignee === "unassigned"}
                onSelect={() => selectAssignee("unassigned")}
                value="unassigned"
              >
                Unassigned
              </CommandItem>
            </CommandGroup>

            {showList ? (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-3 text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                  </div>
                ) : null}

                {lookupError ? (
                  <div className="px-3 py-2 text-xs text-destructive">{lookupError}</div>
                ) : null}

                {showEmpty ? <CommandEmpty>No assignees found.</CommandEmpty> : null}

                {!isLoading && showResults ? (
                  <CommandGroup heading="People">
                    {results.map((result) => (
                      <CommandItem
                        data-checked={currentAssignee === result.name}
                        key={result.key}
                        onSelect={() => selectAssignee(result.name)}
                        value={`${result.name} ${result.secondaryText}`}
                      >
                        <UserAvatar
                          avatarUrl={result.avatarUrl}
                          name={result.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-foreground">{result.name}</div>
                          {result.secondaryText ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {result.secondaryText}
                            </div>
                          ) : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type ClassificationPathFilterProps = {
  currentPath: string | null;
  disabled?: boolean;
  emptyMessage: string;
  endpoint: "/api/task-filter-options/areas" | "/api/task-filter-options/iterations";
  label: string;
  onChange: (path: string | null) => void;
  searchPlaceholder: string;
};

function ClassificationPathFilter({
  currentPath,
  disabled = false,
  emptyMessage,
  endpoint,
  label,
  onChange,
  searchPlaceholder,
}: ClassificationPathFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [options, setOptions] = useState<AzureDevOpsClassificationPathOption[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!isOpen || (hasLoaded && !loadError)) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(endpoint, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | {
              error?: string;
              items?: AzureDevOpsClassificationPathOption[];
            }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? `Failed to load ${label.toLowerCase()} paths.`);
        }

        setOptions(payload?.items ?? []);
        setHasLoaded(true);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setOptions([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : `Failed to load ${label.toLowerCase()} paths.`,
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [endpoint, hasLoaded, isOpen, label, loadError]);

  function selectPath(path: string | null) {
    onChange(path);
    setIsOpen(false);
  }

  return (
    <Popover
      modal={false}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger
        className={getFilterTriggerClassName(currentPath !== null)}
        disabled={disabled}
      >
        {label}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 overflow-hidden p-0"
        sideOffset={6}
      >
        <Command className="bg-transparent p-0">
          <CommandInput
            autoFocus
            disabled={disabled || isLoading}
            placeholder={searchPlaceholder}
          />
          <CommandList className="max-h-72">
            <CommandGroup heading={label}>
              <CommandItem
                data-checked={currentPath === null}
                onSelect={() => selectPath(null)}
                value="__all"
              >
                Any {label.toLowerCase()}
              </CommandItem>
            </CommandGroup>

            {isLoading ? (
              <div className="flex items-center justify-center py-3 text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
              </div>
            ) : null}

            {loadError ? (
              <div className="px-3 py-2 text-xs text-destructive">{loadError}</div>
            ) : null}

            {!isLoading && !loadError ? (
              options.length > 0 ? (
                <CommandGroup heading="Paths">
                  {options.map((option) => (
                    <CommandItem
                      data-checked={currentPath === option.value}
                      key={option.key}
                      onSelect={() => selectPath(option.value)}
                      value={`${option.name} ${option.value}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{option.name}</div>
                        {option.secondaryText ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={(
                                <div className="truncate text-xs text-muted-foreground">
                                  {getCompactTaskPathBreadcrumb(option.secondaryText)}
                                </div>
                              )}
                            />
                            <TooltipContent side="right" sideOffset={8}>
                              {option.value}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              )
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TaskTable({
  error,
  filterOptions,
  filters,
  items,
  title,
}: TaskTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState(filters.query);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const taskDetailHref = (taskId: number) => getTaskDetailHref(taskId, filters);
  const columns = getColumns(taskDetailHref);
  const hasActiveFilters = isTaskListFiltered(filters);

  useEffect(() => {
    setSearchQuery(filters.query);
  }, [filters.query]);

  function navigate(nextFilters: TaskListFilters, mode: "push" | "replace" = "push") {
    startTransition(() => {
      const href = getTaskListHref(nextFilters);

      if (mode === "replace") {
        router.replace(href);
        return;
      }

      router.push(href);
    });
  }

  useEffect(() => {
    if (deferredSearchQuery === filters.query) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          getTaskListHref({
            ...filters,
            query: deferredSearchQuery,
          }),
        );
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [deferredSearchQuery, filters, router, startTransition]);

  function clearSearch() {
    setSearchQuery("");
    navigate(
      {
        ...filters,
        query: "",
      },
      "replace",
    );
  }

  function clearAllFilters() {
    setSearchQuery("");
    navigate(getDefaultTaskListFilters());
  }

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
            <Button size="sm">
              <PlusIcon data-icon="inline-start" />
              <span>New Task</span>
            </Button>
          </>
        )}
        items={[
          { href: "/", label: "Home" },
          { label: title },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-72 flex-1 flex-wrap items-center gap-2">
            <Input
              className="min-w-56 flex-1"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tasks"
              type="search"
              value={searchQuery}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClassificationPathFilter
              currentPath={filters.areaPath}
              disabled={isPending}
              emptyMessage="No area paths found."
              endpoint="/api/task-filter-options/areas"
              label="Area"
              onChange={(areaPath) =>
                navigate({
                  ...filters,
                  areaPath,
                })
              }
              searchPlaceholder="Search area paths"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                className={getFilterTriggerClassName(filters.states.length > 0)}
              >
                State
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Filter by state</DropdownMenuLabel>
                  {filterOptions.states.length > 0 ? (
                    filterOptions.states.map((state) => (
                      <DropdownMenuCheckboxItem
                        key={state}
                        checked={filters.states.includes(state)}
                        onClick={() =>
                          navigate({
                            ...filters,
                            states: toggleSelection(filters.states, state),
                          })
                        }
                      >
                        {state}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No states available</DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <AssigneeFilter
              currentAssignee={filters.assignee}
              disabled={isPending}
              onChange={(assignee) =>
                navigate({
                  ...filters,
                  assignee,
                })
              }
            />
            <ClassificationPathFilter
              currentPath={filters.iterationPath}
              disabled={isPending}
              emptyMessage="No iteration paths found."
              endpoint="/api/task-filter-options/iterations"
              label="Iteration"
              onChange={(iterationPath) =>
                navigate({
                  ...filters,
                  iterationPath,
                })
              }
              searchPlaceholder="Search iteration paths"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                className={getFilterTriggerClassName(filters.priorities.length > 0)}
              >
                Priority
                <ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Filter by priority</DropdownMenuLabel>
                  {filterOptions.priorities.length > 0 ? (
                    filterOptions.priorities.map((priority) => (
                      <DropdownMenuCheckboxItem
                        key={priority}
                        checked={filters.priorities.includes(priority)}
                        onClick={() =>
                          navigate({
                            ...filters,
                            priorities: toggleSelection(filters.priorities, priority),
                          })
                        }
                      >
                        {priority}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No priorities available</DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            {items.length} task{items.length === 1 ? "" : "s"}
          </span>
          {filters.query ? (
            <Button
              disabled={isPending}
              onClick={clearSearch}
              size="sm"
              type="button"
              variant="outline"
            >
              Query: {filters.query}
              <XIcon data-icon="inline-end" />
            </Button>
          ) : null}
          {filters.assignee ? (
            <Button
              disabled={isPending}
              onClick={() => navigate({ ...filters, assignee: null })}
              size="sm"
              type="button"
              variant="outline"
            >
              Assignee: {filters.assignee === "me" ? "Assigned to me" : filters.assignee}
              <XIcon data-icon="inline-end" />
            </Button>
          ) : null}
          {filters.areaPath ? (
            <Button
              disabled={isPending}
              onClick={() => navigate({ ...filters, areaPath: null })}
              size="sm"
              type="button"
              variant="outline"
            >
              Area: {filters.areaPath}
              <XIcon data-icon="inline-end" />
            </Button>
          ) : null}
          {filters.states.map((state) => (
            <Button
              key={state}
              disabled={isPending}
              onClick={() =>
                navigate({
                  ...filters,
                  states: filters.states.filter((value) => value !== state),
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              State: {state}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          {filters.priorities.map((priority) => (
            <Button
              key={priority}
              disabled={isPending}
              onClick={() =>
                navigate({
                  ...filters,
                  priorities: filters.priorities.filter((value) => value !== priority),
                })
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Priority: {priority}
              <XIcon data-icon="inline-end" />
            </Button>
          ))}
          {filters.iterationPath ? (
            <Button
              disabled={isPending}
              onClick={() => navigate({ ...filters, iterationPath: null })}
              size="sm"
              type="button"
              variant="outline"
            >
              Iteration: {filters.iterationPath}
              <XIcon data-icon="inline-end" />
            </Button>
          ) : null}
          {hasActiveFilters ? (
            <Button
              disabled={isPending}
              onClick={clearAllFilters}
              size="sm"
              type="button"
              variant="link"
            >
              Clear all
            </Button>
          ) : null}
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
