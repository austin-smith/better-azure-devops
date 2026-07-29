import type { Metadata } from "next";
import { RepositoryAnalytics } from "@/components/repositories/repository-analytics";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import { parseAnalyticsRange } from "@/lib/analytics/filters";
import { loadRepositoryAnalyticsReport } from "@/lib/analytics/report";
import {
  getRepositoryAnalyticsJob,
  getRepositoryRecord,
} from "@/lib/analytics/refresh";
import { stripRefPrefix } from "@/lib/azure-devops/git/urls";
import { loadRepositoryContext } from "@/lib/repositories/loaders";

type RepositoryAnalyticsPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  description: "Understand repository contribution and change footprint",
  title: "Analytics",
};

export default async function RepositoryAnalyticsPage({
  params,
  searchParams,
}: RepositoryAnalyticsPageProps) {
  const [{ projectId, repositoryId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { repository } = await loadRepositoryContext(
    projectId,
    repositoryId,
  );

  if (!repository.defaultBranch) {
    return <EmptyRepositoryPageState webUrl={repository.webUrl} />;
  }

  const defaultBranch = stripRefPrefix(repository.defaultBranch);
  const branch =
    query.versionType !== "tag" &&
    query.versionType !== "commit" &&
    typeof query.version === "string" &&
    query.version.trim()
      ? stripRefPrefix(query.version.trim())
      : defaultBranch;
  const range = parseAnalyticsRange(query.range);
  const report = loadRepositoryAnalyticsReport({
    branch,
    range,
    repositoryId,
  });
  const activeJob = getRepositoryAnalyticsJob(repositoryId);
  const storedRepository = getRepositoryRecord(repositoryId);

  return (
    <RepositoryAnalytics
      activeJob={activeJob}
      branch={branch}
      lastSyncedAt={
        storedRepository?.lastPullRequestSyncAt ?? null
      }
      projectId={projectId}
      range={range}
      report={report}
      repositoryId={repositoryId}
    />
  );
}
