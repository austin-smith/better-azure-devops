import Link from "next/link";
import { ExternalLinkIcon, GitBranchIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryCheckIcon } from "@/components/repositories/repository-check-icon";
import type { RepositoryPullRequestData } from "@/components/repositories/repository-pull-request-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getRepositoryTreeHref,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";
import { isPullRequestActivityThread } from "@/lib/repositories/pull-request-activity";
import {
  getCheckTone,
  getMergeStatePresentation,
  getPullRequestReviewSummary,
  getPullRequestStatePresentation,
  type CheckTone,
} from "@/lib/repositories/pull-request-presentation";

function MergeSignal({ label, tone }: { label: string; tone: CheckTone }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <RepositoryCheckIcon tone={tone} />
      {label}
    </span>
  );
}

export function RepositoryPullRequestHeader({
  data,
  projectId,
}: {
  data: RepositoryPullRequestData;
  projectId: string;
}) {
  const { pullRequest } = data;
  const state = getPullRequestStatePresentation(pullRequest);
  const StateIcon = state.icon;
  const sourceRepository = pullRequest.sourceRepository ?? {
    id: pullRequest.repository.id,
    projectId,
  };
  const sourceVersion = {
    type: "branch" as const,
    value: stripRefPrefix(pullRequest.sourceRefName),
  };
  const targetVersion = {
    type: "branch" as const,
    value: stripRefPrefix(pullRequest.targetRefName),
  };
  const merge = getMergeStatePresentation(pullRequest.mergeStatus);
  const review = getPullRequestReviewSummary(pullRequest.reviewers);
  const failedChecks = [
    ...data.policies.map((policy) => policy.status),
    ...data.statuses.map((status) => status.state),
  ].filter((value) => getCheckTone(value) === "negative").length;
  const unresolvedThreads = data.threads.filter(
    (thread) =>
      !thread.isDeleted &&
      (thread.status === "active" || thread.status === "pending") &&
      !isPullRequestActivityThread(thread),
  ).length;

  return (
    <header className="flex flex-col gap-2.5 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <h1 className="min-w-0 flex-1 font-heading text-lg leading-snug font-semibold">
          {pullRequest.title}{" "}
          <span className="font-mono text-base font-normal text-muted-foreground">
            #{pullRequest.pullRequestId}
          </span>
        </h1>
        {pullRequest.webUrl ? (
          <Button
            aria-label="Open in Azure DevOps"
            className="shrink-0"
            nativeButton={false}
            render={
              <Link href={pullRequest.webUrl} rel="noreferrer" target="_blank" />
            }
            size="icon-sm"
            variant="ghost"
          >
            <ExternalLinkIcon />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <Badge className={state.className} variant="outline">
          <StateIcon data-icon="inline-start" />
          {state.label}
        </Badge>

        {pullRequest.createdBy ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IdentityImage
              imageUrl={pullRequest.createdBy.imageUrl}
              label={pullRequest.createdBy.displayName}
              size="sm"
            />
            <span className="text-foreground">
              {pullRequest.createdBy.displayName}
            </span>
            {pullRequest.creationDate ? (
              <>
                opened <DateLabel value={pullRequest.creationDate} />
              </>
            ) : null}
          </span>
        ) : null}

        <span className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <Link
            className="truncate hover:text-foreground hover:underline"
            href={getRepositoryTreeHref(
              sourceRepository.projectId,
              sourceRepository.id,
              "/",
              sourceVersion,
            )}
          >
            {sourceVersion.value}
          </Link>
          <span aria-hidden="true">→</span>
          <Link
            className="truncate hover:text-foreground hover:underline"
            href={getRepositoryTreeHref(
              pullRequest.repository.projectId,
              pullRequest.repository.id,
              "/",
              targetVersion,
            )}
          >
            {targetVersion.value}
          </Link>
        </span>

        {pullRequest.labels.map((label) => (
          <Badge key={label} variant="secondary">
            {label}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2.5">
        {merge ? (
          <MergeSignal label={merge.description} tone={merge.tone} />
        ) : null}
        <MergeSignal label={review.label} tone={review.tone} />
        {failedChecks > 0 ? (
          <MergeSignal
            label={`${failedChecks} failing ${failedChecks === 1 ? "check" : "checks"}`}
            tone="negative"
          />
        ) : null}
        {unresolvedThreads > 0 ? (
          <MergeSignal
            label={`${unresolvedThreads} unresolved ${unresolvedThreads === 1 ? "thread" : "threads"}`}
            tone="pending"
          />
        ) : null}
      </div>
    </header>
  );
}
