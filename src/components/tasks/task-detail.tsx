"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, GitBranchIcon, Loader2Icon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AppHeader } from "@/components/app-header";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";
import { getDefaultTaskViewHref } from "@/lib/tasks/navigation";

type TaskDetailProps = {
  detail: TaskDetailData | null;
  detailError: string | null;
  projectLabel: string;
  taskId: number;
};

type AssigneeOption = {
  avatarUrl: string | null;
  key: string;
  name: string;
  secondaryText: string;
  value: string;
};

type CommentPart = {
  type: "mention" | "text";
  value: string;
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

function pullRequestVariant(state: string) {
  switch (state.toLowerCase()) {
    case "completed":
      return "secondary";
    case "abandoned":
      return "destructive";
    default:
      return "outline";
  }
}

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between pb-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {count !== undefined ? (
        <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </div>
  );
}

function SidebarField({
  label,
  children,
}: {
  children: React.ReactNode;
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

function getCommentParts(comment: TaskDetailData["comments"][number]): CommentPart[] {
  if (Array.isArray(comment.parts) && comment.parts.length > 0) {
    return comment.parts;
  }

  return comment.text ? [{ type: "text", value: comment.text }] : [];
}

function CommentBody({
  comment,
}: {
  comment: TaskDetailData["comments"][number];
}) {
  const parts = getCommentParts(comment);

  if (parts.length === 0) {
    return <div className="mt-1 text-sm leading-relaxed text-foreground">No comment text.</div>;
  }

  return (
    <div className="mt-1 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
      {parts.map((part, index) =>
        part.type === "mention" ? (
          <span
            key={`${comment.id}-mention-${index}`}
            className="rounded-md bg-sky-500/12 px-1.5 py-0.5 font-medium text-sky-700 ring-1 ring-inset ring-sky-500/25 dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/30"
          >
            {part.value}
          </span>
        ) : (
          <span key={`${comment.id}-text-${index}`}>{part.value}</span>
        ),
      )}
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
                onValueChange={(value) => {
                  setQuery(value);
                }}
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

export function TaskDetail({
  detail,
  detailError,
  projectLabel,
  taskId,
}: TaskDetailProps) {
  const [currentDetail, setCurrentDetail] = useState(detail);

  useEffect(() => {
    setCurrentDetail(detail);
  }, [detail]);

  const comments = currentDetail?.comments ?? [];
  const linkedPullRequests = currentDetail?.linkedPullRequests ?? [];
  const headerItems = [
    { href: getDefaultTaskViewHref(), label: projectLabel },
    { label: `Task #${taskId}` },
  ];

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={headerItems}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start gap-4 border-b px-4 py-3 md:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold leading-normal text-foreground">
                {currentDetail?.title || `Task #${taskId}`}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {currentDetail ? (
                  <>
                    <Badge variant={statusVariant(currentDetail.state)}>
                      {currentDetail.state}
                    </Badge>
                    <PriorityBadge priority={currentDetail.priority} />
                  </>
                ) : null}
              </div>
            </div>
            {currentDetail?.url ? (
              <a
                className={buttonVariants({ size: "icon-xs", variant: "ghost" })}
                href={currentDetail.url}
                rel="noreferrer"
                target="_blank"
              >
                <ArrowUpRightIcon />
              </a>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
              {detailError ? (
                <div className="mb-4 border-l-2 border-destructive pl-3 text-sm text-destructive">
                  {detailError}
                </div>
              ) : null}

              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {currentDetail?.description || "No description."}
              </div>

              <div className="mt-8">
                <SectionLabel
                  title="Linked pull requests"
                  count={linkedPullRequests.length}
                />
                <div className="space-y-2">
                  {linkedPullRequests.length > 0 ? (
                    linkedPullRequests.map((pullRequest) => (
                      <a
                        key={pullRequest.id}
                        className="block rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        href={pullRequest.url || undefined}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              {pullRequest.repositoryName} · #{pullRequest.id}
                            </div>
                            <div className="mt-0.5 text-sm font-medium text-foreground">
                              {pullRequest.title}
                            </div>
                          </div>
                          <Badge variant={pullRequestVariant(pullRequest.state)}>
                            {pullRequest.isDraft ? "Draft" : pullRequest.state}
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <GitBranchIcon className="size-3" />
                            {pullRequest.sourceBranch || "source"} →{" "}
                            {pullRequest.targetBranch || "target"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <UserAvatar
                              avatarUrl={pullRequest.authorAvatarUrl}
                              name={pullRequest.authorName}
                              size="sm"
                            />
                            {pullRequest.authorName}
                          </span>
                          <DateLabel value={pullRequest.createdAt} />
                        </div>
                      </a>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">None</p>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <SectionLabel
                  title="Discussion"
                  count={comments.length}
                />
                <div className="space-y-4">
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <Card key={comment.id} size="sm" className="p-3 gap-0 shadow-sm">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            avatarUrl={comment.authorAvatarUrl}
                            name={comment.authorName}
                            size="sm"
                          />
                          <div className="flex min-w-0 flex-1 items-baseline gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">
                              {comment.authorName}
                            </span>
                            <DateLabel
                              className="shrink-0 text-xs text-muted-foreground"
                              value={comment.createdAt}
                            />
                          </div>
                        </div>
                        <CommentBody comment={comment} />
                      </Card>
                    ))
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">No comments yet.</p>
                  )}
                </div>
              </div>
            </div>

            <aside className="w-52 shrink-0 border-l overflow-y-auto p-4 md:w-60">
              <div className="space-y-4">
                <AssigneeField
                  detail={currentDetail}
                  onUpdated={setCurrentDetail}
                  taskId={taskId}
                />

                <SidebarField label="Updated">
                  {currentDetail ? (
                    <DateLabel value={currentDetail.updatedAt} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </SidebarField>

                <Separator />

                <SidebarField label="Area">
                  {currentDetail?.areaPath || "—"}
                </SidebarField>

                <SidebarField label="Iteration">
                  {currentDetail?.iterationPath || "—"}
                </SidebarField>

                <SidebarField label="Reason">
                  {currentDetail?.reason || "—"}
                </SidebarField>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
