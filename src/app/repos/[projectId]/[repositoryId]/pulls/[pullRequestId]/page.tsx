import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  RepositoryPullRequestDetail,
  type RepositoryPullRequestDiscussionFilter,
  type RepositoryPullRequestTab,
} from "@/components/repositories/repository-pull-request-detail";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import { loadRepositoryPullRequest } from "@/lib/repositories/loaders";

type RepositoryPullRequestPageProps = {
  params: Promise<{
    projectId: string;
    pullRequestId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<{
    discussion?: string | string[];
    filesCursor?: string | string[];
    tab?: string | string[];
    threadId?: string | string[];
  }>;
};

function readSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function parseTab(value: string | undefined): RepositoryPullRequestTab {
  return value === "files" || value === "updates" || value === "commits"
    ? value
    : "overview";
}

function parseDiscussionFilter(
  value: string | undefined,
): RepositoryPullRequestDiscussionFilter {
  return value === "all" ? "all" : "active";
}

function parsePositiveInteger(value: string | undefined) {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function generateMetadata({
  params,
}: RepositoryPullRequestPageProps): Promise<Metadata> {
  const { pullRequestId } = await params;

  return {
    title: `Pull request #${pullRequestId}`,
  };
}

export default async function RepositoryPullRequestPage({
  params,
  searchParams,
}: RepositoryPullRequestPageProps) {
  const { projectId, pullRequestId, repositoryId } = await params;
  const query = await searchParams;
  const parsedPullRequestId = Number(pullRequestId);
  const tab = parseTab(readSingleSearchParam(query.tab));
  const discussionFilter = parseDiscussionFilter(
    readSingleSearchParam(query.discussion),
  );
  const filesCursor = readSingleSearchParam(query.filesCursor) ?? null;
  const threadId = parsePositiveInteger(readSingleSearchParam(query.threadId));

  if (!Number.isSafeInteger(parsedPullRequestId) || parsedPullRequestId <= 0) {
    notFound();
  }

  let data;

  try {
    data = await loadRepositoryPullRequest(
      projectId,
      repositoryId,
      parsedPullRequestId,
      {
        filesCursor,
        includeFiles: tab === "files",
        threadId,
      },
    );
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      notFound();
    }

    throw error;
  }

  return (
    <RepositoryPullRequestDetail
      data={data}
      discussionFilter={discussionFilter}
      projectId={projectId}
      repositoryId={repositoryId}
      tab={tab}
    />
  );
}
