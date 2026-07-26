import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepositoryCommitDetail } from "@/components/repositories/repository-commit-detail";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import {
  getDefaultRepositoryVersion,
  loadRepositoryCommitDetail,
} from "@/lib/repositories/loaders";
import {
  parseGitVersionDescriptor,
  type RepositoryHistoryContext,
} from "@/lib/azure-devops/git/urls";

type RepositoryCommitPageProps = {
  params: Promise<{
    commitId: string;
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RepositoryCommitPageProps): Promise<Metadata> {
  const { commitId } = await params;

  return {
    title: `Commit ${commitId.slice(0, 8)}`,
  };
}

export default async function RepositoryCommitPage({
  params,
  searchParams,
}: RepositoryCommitPageProps) {
  const [{ commitId, projectId, repositoryId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  let data;

  try {
    data = await loadRepositoryCommitDetail(
      projectId,
      repositoryId,
      commitId,
      cursor,
    );
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      notFound();
    }

    throw error;
  }
  const defaultVersion =
    getDefaultRepositoryVersion(data.repository) ?? {
      type: "commit" as const,
      value: data.commit.commitId,
    };
  const historyVersion =
    parseGitVersionDescriptor(
      {
        version: query.historyVersion,
        versionType: query.historyVersionType,
      },
      data.repository.defaultBranch,
    ) ?? defaultVersion;
  const history: RepositoryHistoryContext = {
    cursor:
      typeof query.historyCursor === "string"
        ? query.historyCursor
        : null,
    path:
      typeof query.historyPath === "string" ? query.historyPath : null,
    version: historyVersion,
  };

  return (
    <RepositoryCommitDetail
      changes={data.items}
      changesCursor={cursor}
      commit={data.commit}
      nextCursor={data.nextCursor}
      projectId={projectId}
      repositoryId={repositoryId}
      history={history}
    />
  );
}
