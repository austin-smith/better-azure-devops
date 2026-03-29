"use client";

import {
  startTransition,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";

type TaskDetailSidebarProps = {
  detail: TaskDetailData | null;
  onUpdated: (detail: TaskDetailData) => void;
  taskId: number;
};

type AssigneeOption = {
  avatarUrl: string | null;
  key: string;
  name: string;
  secondaryText: string;
  value: string;
};

function SidebarField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function AssigneeField({
  detail,
  onUpdated,
  taskId,
}: {
  detail: TaskDetailData | null;
  onUpdated: (detail: TaskDetailData) => void;
  taskId: number;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssigneeOption[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const showResults = results.length > 0;
  const showEmpty = !isLoading && query.trim().length >= 2 && results.length === 0;
  const showList =
    isLoading || Boolean(lookupError) || Boolean(saveError) || showResults || showEmpty;

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setIsLoading(false);
      setLookupError(null);
      setSaveError(null);
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
              items?: AssigneeOption[];
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

  async function updateAssignee(assignee: string | null) {
    if (!detail) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignee,
          revision: detail.revision,
        }),
      });
      const payload = (await response.json()) as
        | {
            error?: string;
            item?: TaskDetailData;
          }
        | undefined;

      if (!response.ok || !payload?.item) {
        throw new Error(payload?.error ?? "Failed to update assignee.");
      }

      onUpdated(payload.item);
      setIsOpen(false);
      setQuery("");
      setResults([]);
      setLookupError(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to update assignee.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SidebarField label="Assignee">
      {detail ? (
        <Popover
          modal={false}
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (open) {
              setQuery("");
            }
          }}
        >
          <PopoverTrigger
            className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
            disabled={isSaving}
          >
            <UserAvatar
              avatarUrl={detail.assigneeAvatarUrl}
              name={detail.assignee}
              size="sm"
            />
            <span className="min-w-0 flex-1 truncate">{detail.assignee}</span>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-(--anchor-width) min-w-0 overflow-hidden p-0"
            sideOffset={6}
          >
            <Command className="bg-transparent p-0" shouldFilter={false}>
              <CommandInput
                autoFocus
                disabled={isSaving}
                onValueChange={setQuery}
                placeholder="Search assignee"
                value={query}
              />

              {showList ? (
                <CommandList className="max-h-52">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-3 text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                    </div>
                  ) : null}

                  {lookupError ? (
                    <div className="px-3 py-2 text-xs text-destructive">{lookupError}</div>
                  ) : null}

                  {saveError ? (
                    <div className="px-3 py-2 text-xs text-destructive">{saveError}</div>
                  ) : null}

                  {showEmpty ? <CommandEmpty>No assignees found.</CommandEmpty> : null}

                  {!isLoading && showResults ? (
                    <CommandGroup>
                      {results.map((result) => (
                        <CommandItem
                          key={result.key}
                          disabled={isSaving}
                          onSelect={() => {
                            void updateAssignee(result.value);
                          }}
                          value={result.key}
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
                </CommandList>
              ) : null}
            </Command>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </SidebarField>
  );
}

export function TaskDetailSidebar({
  detail,
  onUpdated,
  taskId,
}: TaskDetailSidebarProps) {
  return (
    <aside className="w-52 shrink-0 overflow-y-auto border-l p-4 md:w-60">
      <div className="space-y-4">
        <AssigneeField detail={detail} onUpdated={onUpdated} taskId={taskId} />

        <SidebarField label="Updated">
          {detail ? <DateLabel value={detail.updatedAt} /> : <span className="text-muted-foreground">—</span>}
        </SidebarField>

        <Separator />

        <SidebarField label="Type">
          {detail ? (
            <WorkItemTypeLabel type={detail.type} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </SidebarField>

        <SidebarField label="Area">{detail?.areaPath || "—"}</SidebarField>

        <SidebarField label="Iteration">{detail?.iterationPath || "—"}</SidebarField>

        <SidebarField label="Reason">{detail?.reason || "—"}</SidebarField>
      </div>
    </aside>
  );
}
