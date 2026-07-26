import type { Metadata } from "next";
import { RepositoryPullRequests } from "@/components/repositories/repository-pull-requests";
import type { PullRequestStatus } from "@/lib/azure-devops/git/pull-requests";
import { loadRepositoryPullRequests } from "@/lib/repositories/loaders";

type RepositoryPullRequestsPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Pull requests",
};

function parseStatus(value: unknown): PullRequestStatus {
  return value === "abandoned" ||
    value === "all" ||
    value === "completed"
    ? value
    : "active";
}

export default async function RepositoryPullRequestsPage({
  params,
  searchParams,
}: RepositoryPullRequestsPageProps) {
  const [{ projectId, repositoryId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  const status = parseStatus(query.status);
  const data = await loadRepositoryPullRequests(projectId, repositoryId, {
    cursor,
    status,
  });

  return (
    <RepositoryPullRequests
      cursor={cursor}
      items={data.items}
      nextCursor={data.nextCursor}
      projectId={projectId}
      repositoryId={repositoryId}
      status={status}
    />
  );
}
