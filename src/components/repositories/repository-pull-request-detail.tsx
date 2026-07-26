import {
  FileDiffIcon,
  GitCommitHorizontalIcon,
  HistoryIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { RepositoryPullRequestCommits } from "@/components/repositories/repository-pull-request-commits";
import { RepositoryPullRequestFiles } from "@/components/repositories/repository-pull-request-files";
import { RepositoryPullRequestHeader } from "@/components/repositories/repository-pull-request-header";
import { RepositoryPullRequestOverview } from "@/components/repositories/repository-pull-request-overview";
import { RepositoryPullRequestUpdates } from "@/components/repositories/repository-pull-request-updates";
import { RepositoryTabNav } from "@/components/repositories/repository-tab-nav";
import { getRepositoryHref } from "@/lib/azure-devops/git/urls";
import { isPullRequestActivityThread } from "@/lib/repositories/pull-request-activity";
import type { loadRepositoryPullRequest } from "@/lib/repositories/loaders";

export type RepositoryPullRequestTab =
  | "commits"
  | "files"
  | "overview"
  | "updates";
export type RepositoryPullRequestDiscussionFilter = "active" | "all";
export type RepositoryPullRequestData = Awaited<
  ReturnType<typeof loadRepositoryPullRequest>
>;

export function RepositoryPullRequestDetail({
  data,
  discussionFilter,
  projectId,
  repositoryId,
  tab,
}: {
  data: RepositoryPullRequestData;
  discussionFilter: RepositoryPullRequestDiscussionFilter;
  projectId: string;
  repositoryId: string;
  tab: RepositoryPullRequestTab;
}) {
  const { pullRequest } = data;
  const baseHref = `${getRepositoryHref(
    projectId,
    repositoryId,
  )}/pulls/${pullRequest.pullRequestId}`;
  const sourceRepository = pullRequest.sourceRepository ?? {
    id: pullRequest.repository.id,
    projectId,
  };
  const discussionCount = data.threads.filter(
    (thread) => !thread.isDeleted && !isPullRequestActivityThread(thread),
  ).length;

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <RepositoryPullRequestHeader data={data} projectId={projectId} />

      <RepositoryTabNav
        ariaLabel="Pull request sections"
        className="border-b"
        items={[
          {
            active: tab === "overview",
            count: discussionCount,
            href: baseHref,
            icon: MessagesSquareIcon,
            label: "Conversation",
          },
          {
            active: tab === "files",
            count: data.changedFileCount
              ? data.changedFileCount.isCapped
                ? `${data.changedFileCount.value}+`
                : data.changedFileCount.value
              : (data.files?.files.length ?? null),
            href: `${baseHref}?tab=files`,
            icon: FileDiffIcon,
            label: "Files",
          },
          {
            active: tab === "commits",
            count: pullRequest.commits.length,
            href: `${baseHref}?tab=commits`,
            icon: GitCommitHorizontalIcon,
            label: "Commits",
          },
          {
            active: tab === "updates",
            count: data.iterations.length,
            href: `${baseHref}?tab=updates`,
            icon: HistoryIcon,
            label: "Updates",
          },
        ]}
      />

      {tab === "overview" ? (
        <RepositoryPullRequestOverview
          data={data}
          discussionFilter={discussionFilter}
          projectId={projectId}
          repositoryId={repositoryId}
        />
      ) : null}
      {tab === "files" ? (
        <RepositoryPullRequestFiles
          data={data}
          projectId={projectId}
          repositoryId={repositoryId}
        />
      ) : null}
      {tab === "updates" ? (
        <RepositoryPullRequestUpdates
          iterations={data.iterations}
          sourceRepository={sourceRepository}
        />
      ) : null}
      {tab === "commits" ? (
        <RepositoryPullRequestCommits
          commits={pullRequest.commits}
          sourceRepository={sourceRepository}
        />
      ) : null}
    </div>
  );
}
