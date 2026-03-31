"use client";

import {
  useDeferredValue,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Loader2Icon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { ProjectImage } from "@/components/project-image";
import { WorkItemTypeLabel } from "@/components/tasks/work-item-type-label";
import { UserAvatar } from "@/components/user-avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type {
  AzureDevOpsTaskDetail as TaskDetailData,
  AzureDevOpsTaskEditMetadata,
} from "@/lib/azure-devops/tasks";
import type { TaskDetailEditableValues } from "@/lib/tasks/task-detail-edit";

type TaskDetailSidebarProps = {
  detail: TaskDetailData | null;
  draftValues: TaskDetailEditableValues | null;
  editMetadata: AzureDevOpsTaskEditMetadata | null;
  editMetadataError: string | null;
  isDirty: boolean;
  isLoadingEditMetadata: boolean;
  isSaving: boolean;
  onDraftChange: (values: TaskDetailEditableValues) => void;
  saveError: string | null;
  taskProjectId: string | null;
};

type SearchOption = {
  avatarUrl?: string | null;
  key: string;
  label: string;
  secondaryText: string;
  value: string | null;
};

type SearchOptionResponseItem = {
  avatarUrl?: string | null;
  key: string;
  name: string;
  secondaryText: string;
  value: string | null;
};

function SidebarField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function SearchPopoverField({
  disabled,
  emptyMessage,
  endpoint,
  minQueryLength = 2,
  onSelect,
  placeholder,
  selectedContent,
  staticOptions = [],
}: {
  disabled: boolean;
  emptyMessage: string;
  endpoint: string;
  minQueryLength?: number;
  onSelect: (option: SearchOption) => void;
  placeholder: string;
  selectedContent: ReactNode;
  staticOptions?: readonly SearchOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchOption[]>([]);
  const trimmedQuery = deferredQuery.trim();
  const shouldLookup = trimmedQuery.length >= minQueryLength;
  const showDynamicResults = results.length > 0;
  const showStaticOptions = staticOptions.length > 0;
  const showEmpty =
    !isLoading &&
    !lookupError &&
    (shouldLookup || minQueryLength === 0) &&
    !showStaticOptions &&
    results.length === 0;
  const showList =
    isLoading ||
    Boolean(lookupError) ||
    showStaticOptions ||
    showDynamicResults ||
    showEmpty;

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setLookupError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!shouldLookup && minQueryLength > 0) {
      setResults([]);
      setLookupError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setLookupError(null);

      try {
        const requestUrl = new URL(endpoint, window.location.origin);
        requestUrl.searchParams.set("q", trimmedQuery);

        const response = await fetch(requestUrl, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | {
              error?: string;
              items?: SearchOptionResponseItem[];
            }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load options.");
        }

        setResults(
          (payload?.items ?? []).map((item) => ({
            avatarUrl: item.avatarUrl,
            key: item.key,
            label: item.name,
            secondaryText: item.secondaryText,
            value: item.value,
          })),
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setLookupError(
          error instanceof Error ? error.message : "Failed to load options.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [endpoint, isOpen, minQueryLength, shouldLookup, trimmedQuery]);

  return (
    <Popover
      modal={false}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
      }}
    >
      <PopoverTrigger
        className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
        disabled={disabled}
      >
        {selectedContent}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-0 overflow-hidden p-0"
        sideOffset={6}
      >
        <Command className="bg-transparent p-0" shouldFilter={false}>
          <CommandInput
            autoFocus
            disabled={disabled}
            onValueChange={setQuery}
            placeholder={placeholder}
            value={query}
          />

          {showList ? (
            <CommandList className="max-h-56">
              {isLoading ? (
                <div className="flex items-center justify-center py-3 text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                </div>
              ) : null}

              {lookupError ? (
                <div className="px-3 py-2 text-xs text-destructive">{lookupError}</div>
              ) : null}

              {showStaticOptions ? (
                <CommandGroup>
                  {staticOptions.map((option) => (
                    <CommandItem
                      key={option.key}
                      disabled={disabled}
                      onSelect={() => {
                        onSelect(option);
                        setIsOpen(false);
                      }}
                      value={option.key}
                    >
                      {option.avatarUrl !== undefined ? (
                        <UserAvatar
                          avatarUrl={option.avatarUrl}
                          name={option.label}
                          size="sm"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{option.label}</div>
                        {option.secondaryText ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {option.secondaryText}
                          </div>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {!isLoading && showDynamicResults ? (
                <CommandGroup>
                  {results.map((option) => (
                    <CommandItem
                      key={option.key}
                      disabled={disabled}
                      onSelect={() => {
                        onSelect(option);
                        setIsOpen(false);
                      }}
                      value={option.key}
                    >
                      {option.avatarUrl !== undefined ? (
                        <UserAvatar
                          avatarUrl={option.avatarUrl}
                          name={option.label}
                          size="sm"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-foreground">{option.label}</div>
                        {option.secondaryText ? (
                          <div className="truncate text-xs text-muted-foreground">
                            {option.secondaryText}
                          </div>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {showEmpty ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
            </CommandList>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function sortPriorityOptions(values: readonly string[]) {
  return [...values].sort((left, right) => {
    const leftValue = Number(left);
    const rightValue = Number(right);

    if (Number.isFinite(leftValue) && Number.isFinite(rightValue)) {
      return leftValue - rightValue;
    }

    return left.localeCompare(right, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export function TaskDetailSidebar({
  detail,
  draftValues,
  editMetadata,
  editMetadataError,
  isDirty,
  isLoadingEditMetadata,
  isSaving,
  onDraftChange,
  saveError,
  taskProjectId,
}: TaskDetailSidebarProps) {
  const lookupProjectId = detail?.projectId ?? taskProjectId;
  const areaLookupEndpoint = `/api/task-filter-options/areas${
    lookupProjectId ? `?project=${encodeURIComponent(lookupProjectId)}` : ""
  }`;
  const iterationLookupEndpoint = `/api/task-filter-options/iterations${
    lookupProjectId ? `?project=${encodeURIComponent(lookupProjectId)}` : ""
  }`;
  const priorityOptions = sortPriorityOptions([
    ...(draftValues?.priority ? [draftValues.priority] : []),
    ...(editMetadata?.priorities ?? []),
  ].filter((value, index, array) => array.indexOf(value) === index));

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l p-4">
      <div className="flex flex-col gap-4">
        {draftValues ? (
          <>
            {isDirty ? (
              <div className="text-xs text-muted-foreground">
                You have unsaved changes.
              </div>
            ) : null}

            {saveError ? (
              <div className="text-xs text-destructive">{saveError}</div>
            ) : null}

            <SidebarField label="Title">
              <Input
                disabled={isSaving}
                onChange={(event) =>
                  onDraftChange({
                    ...draftValues,
                    title: event.target.value,
                  })
                }
                value={draftValues.title}
              />
            </SidebarField>

            <SidebarField label="Assignee">
              <SearchPopoverField
                disabled={isSaving}
                emptyMessage="No assignees found."
                endpoint="/api/assignees"
                onSelect={(option) =>
                  onDraftChange({
                    ...draftValues,
                    assignee: {
                      avatarUrl: option.avatarUrl ?? null,
                      label: option.label,
                      value: option.value,
                    },
                  })
                }
                placeholder="Search assignee"
                selectedContent={
                  <>
                    <UserAvatar
                      avatarUrl={draftValues.assignee.avatarUrl}
                      name={draftValues.assignee.label}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {draftValues.assignee.label}
                    </span>
                  </>
                }
                staticOptions={[
                  {
                    avatarUrl: null,
                    key: "unassigned",
                    label: "Unassigned",
                    secondaryText: "",
                    value: null,
                  },
                ]}
              />
            </SidebarField>

            <SidebarField label="Priority">
              <Select
                disabled={isSaving || isLoadingEditMetadata || priorityOptions.length === 0}
                onValueChange={(priority) => {
                  if (!priority) {
                    return;
                  }

                  onDraftChange({
                    ...draftValues,
                    priority,
                  });
                }}
                value={draftValues.priority}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {draftValues.priority ? `P${draftValues.priority}` : "Select priority"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        P{priority}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {editMetadataError ? (
                <div className="mt-1 text-xs text-destructive">{editMetadataError}</div>
              ) : null}
            </SidebarField>

            <SidebarField label="Area">
              <SearchPopoverField
                disabled={isSaving}
                emptyMessage="No areas found."
                endpoint={areaLookupEndpoint}
                minQueryLength={0}
                onSelect={(option) =>
                  onDraftChange({
                    ...draftValues,
                    areaPath: option.value ?? draftValues.areaPath,
                  })
                }
                placeholder="Search area path"
                selectedContent={
                  <span className="truncate text-left">{draftValues.areaPath}</span>
                }
              />
            </SidebarField>

            <SidebarField label="Iteration">
              <SearchPopoverField
                disabled={isSaving}
                emptyMessage="No iterations found."
                endpoint={iterationLookupEndpoint}
                minQueryLength={0}
                onSelect={(option) =>
                  onDraftChange({
                    ...draftValues,
                    iterationPath: option.value ?? draftValues.iterationPath,
                  })
                }
                placeholder="Search iteration path"
                selectedContent={
                  <span className="truncate text-left">{draftValues.iterationPath}</span>
                }
              />
            </SidebarField>

            <Separator />
          </>
        ) : null}

        <SidebarField label="Updated">
          {detail ? <DateLabel value={detail.updatedAt} /> : <span className="text-muted-foreground">—</span>}
        </SidebarField>

        <SidebarField label="Type">
          {detail ? (
            <WorkItemTypeLabel type={detail.type} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SidebarField>

        <SidebarField label="Project">
          {detail ? (
            <div className="flex items-center gap-2">
              <ProjectImage
                className="size-4 rounded-sm ring-0"
                imageClassName="rounded-sm"
                imageUrl={detail.projectImageUrl}
                name={detail.projectName}
                size="sm"
              />
              <span className="truncate">{detail.projectName}</span>
            </div>
          ) : (
            "—"
          )}
        </SidebarField>

        <SidebarField label="Reason">{detail?.reason || "—"}</SidebarField>
      </div>
    </aside>
  );
}
