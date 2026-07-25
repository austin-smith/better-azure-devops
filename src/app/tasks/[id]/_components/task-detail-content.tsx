"use client";

import {
  GitBranchIcon,
  GitPullRequestIcon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { TaskComments } from "./task-comments";
import { TaskDetailSectionLabel } from "./task-detail-section-label";
import { DateLabel } from "@/components/date-label";
import { MarkdownEditor } from "@/components/tasks/markdown-editor";
import { TaskMarkup } from "@/components/tasks/task-markup";
import { UserAvatar } from "@/components/user-avatar";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AzureDevOpsTaskDetail as TaskDetailData } from "@/lib/azure-devops/tasks";

type TaskDetailContentProps = {
  descriptionDraft: string;
  descriptionHasUnsavedChanges?: boolean;
  detail: TaskDetailData | null;
  detailError: string | null;
  draftResetKey?: number;
  isSaving: boolean;
  mode: "create" | "edit";
  onDescriptionChange: (description: string) => void;
};

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

function DescriptionReadView({
  description,
}: {
  description?: TaskDetailData["description"];
}) {
  return (
    <Card size="sm" className="min-w-0 gap-0 py-0 shadow-none">
      <CardContent className="p-3">
        {description?.content.trim() ? (
          <TaskMarkup markup={description} />
        ) : (
          <Empty className="min-h-36 flex-none rounded-md bg-muted/20">
            <EmptyHeader>
              <EmptyTitle>No description.</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskDetailContent({
  descriptionDraft,
  descriptionHasUnsavedChanges = false,
  detail,
  detailError,
  draftResetKey = 0,
  isSaving,
  mode,
  onDescriptionChange,
}: TaskDetailContentProps) {
  const descriptionHeadingId = useId();
  const descriptionPanelId = useId();
  const descriptionUnsavedId = useId();
  const editDescriptionButtonRef = useRef<HTMLButtonElement>(null);
  const shouldFocusEditButtonAfterCloseRef = useRef(false);
  const [descriptionEditState, setDescriptionEditState] = useState<{
    detailKey: string;
    draftResetKey: number;
  } | null>(null);
  const comments = detail?.comments ?? [];
  const linkedPullRequests = detail?.linkedPullRequests ?? [];
  const detailEditKey = detail ? `${detail.id}:${detail.revision}` : null;
  const visibleDescription = descriptionHasUnsavedChanges
    ? {
        content: descriptionDraft,
        format: "markdown" as const,
      }
    : detail?.description;
  const isDescriptionEditing =
    descriptionEditState?.detailKey === detailEditKey &&
    descriptionEditState.draftResetKey === draftResetKey;
  const showDescriptionEditor = mode === "create" || isDescriptionEditing;

  useLayoutEffect(() => {
    if (!shouldFocusEditButtonAfterCloseRef.current || showDescriptionEditor) {
      return;
    }

    shouldFocusEditButtonAfterCloseRef.current = false;
    editDescriptionButtonRef.current?.focus();
  }, [showDescriptionEditor]);

  function closeDescriptionEditor() {
    shouldFocusEditButtonAfterCloseRef.current = true;
    setDescriptionEditState(null);
  }

  const descriptionSectionAction = mode === "create" ? null : (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {descriptionHasUnsavedChanges ? (
        <Badge id={descriptionUnsavedId} variant="secondary">Unsaved</Badge>
      ) : null}
      {isDescriptionEditing ? (
        <Button
          aria-label="Close description editor"
          aria-controls={descriptionPanelId}
          aria-expanded="true"
          disabled={isSaving}
          onClick={closeDescriptionEditor}
          size="sm"
          type="button"
          variant="ghost"
        >
          <XIcon data-icon="inline-start" />
          Close
        </Button>
      ) : (
        <Button
          aria-label="Edit description"
          aria-controls={descriptionPanelId}
          aria-expanded="false"
          disabled={isSaving}
          onClick={() => {
            if (!detailEditKey) {
              return;
            }

            setDescriptionEditState({
              detailKey: detailEditKey,
              draftResetKey,
            });
          }}
          ref={editDescriptionButtonRef}
          size="sm"
          type="button"
          variant="ghost"
        >
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
      {detailError ? (
        <Alert className="mb-4" variant="destructive">
          <AlertDescription>{detailError}</AlertDescription>
        </Alert>
      ) : null}

      {detail ? (
        <div className="grid min-w-0 gap-3">
          <TaskDetailSectionLabel
            action={descriptionSectionAction}
            headingId={descriptionHeadingId}
            title="Description"
          />
          <div
            aria-busy={isSaving ? "true" : undefined}
            aria-describedby={descriptionHasUnsavedChanges
              ? descriptionUnsavedId
              : undefined}
            aria-labelledby={descriptionHeadingId}
            id={descriptionPanelId}
            role="region"
          >
            {showDescriptionEditor ? (
              <MarkdownEditor
                ariaLabel="Description markdown content"
                autoFocus
                disabled={isSaving}
                modeAriaLabel="Description markdown editor mode"
                onChange={onDescriptionChange}
                placeholder="Add a description..."
                previewAriaLabel="Description markdown preview"
                statisticsAriaLabel="Description markdown statistics"
                toolbarAriaLabel="Description markdown formatting"
                value={descriptionDraft}
              />
            ) : (
              <DescriptionReadView description={visibleDescription} />
            )}
          </div>
        </div>
      ) : (
        <TaskMarkup emptyMessage="No description." markup={null} />
      )}

      <div className="mt-8">
        <TaskDetailSectionLabel
          title="Pull requests"
          count={linkedPullRequests.length}
        />
        <div className="flex flex-col gap-2">
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
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GitPullRequestIcon />
                </EmptyMedia>
                <EmptyTitle>No pull requests.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      <TaskComments comments={comments} />
    </div>
  );
}
