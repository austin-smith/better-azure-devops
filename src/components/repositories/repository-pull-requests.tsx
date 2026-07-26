import { GitPullRequestArrowIcon } from "lucide-react";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { RepositoryPullRequestRow } from "@/components/repositories/repository-pull-request-row";
import { RepositoryTabNav } from "@/components/repositories/repository-tab-nav";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AzureGitPullRequest } from "@/lib/azure-devops/git/types";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import type { PullRequestStatus } from "@/lib/azure-devops/git/pull-requests";

const PULL_REQUEST_PAGE_SIZE = 50;

const STATUS_FILTERS: Array<{ label: string; value: PullRequestStatus }> = [
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Abandoned", value: "abandoned" },
  { label: "All", value: "all" },
];

function getPullRequestPageHref(
  projectId: string,
  repositoryId: string,
  status: PullRequestStatus,
  cursor?: string | null,
) {
  const searchParams = new URLSearchParams({ status });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return `${getRepositoryHref(projectId, repositoryId)}/pulls?${searchParams}`;
}

export function RepositoryPullRequests({
  cursor,
  items,
  nextCursor,
  projectId,
  repositoryId,
  status,
}: {
  cursor: string | null;
  items: AzureGitPullRequest[];
  nextCursor: string | null;
  projectId: string;
  repositoryId: string;
  status: PullRequestStatus;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <RepositoryTabNav
          ariaLabel="Pull request status"
          className="border-b bg-muted/30 px-2"
          items={STATUS_FILTERS.map((filter) => ({
            active: status === filter.value,
            href: getPullRequestPageHref(projectId, repositoryId, filter.value),
            label: filter.label,
          }))}
        />

        {items.length === 0 ? (
          <Empty className="min-h-56">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GitPullRequestArrowIcon />
              </EmptyMedia>
              <EmptyTitle>No {status} pull requests</EmptyTitle>
              <EmptyDescription>Try another status filter.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ol className="divide-y">
            {items.map((pullRequest) => (
              <RepositoryPullRequestRow
                key={pullRequest.pullRequestId}
                pullRequest={pullRequest}
              />
            ))}
          </ol>
        )}
      </div>

      <RepositoryPager
        buildHref={(pageCursor) =>
          getPullRequestPageHref(projectId, repositoryId, status, pageCursor)
        }
        cursor={cursor}
        label="Pull request pages"
        nextCursor={nextCursor}
        pageSize={PULL_REQUEST_PAGE_SIZE}
      />
    </div>
  );
}
