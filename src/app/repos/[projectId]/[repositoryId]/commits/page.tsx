import type { Metadata } from "next";
import { RepositoryCommitList } from "@/components/repositories/repository-commit-list";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import {
  getDefaultRepositoryVersion,
  loadRepositoryCommits,
  loadRepositoryContext,
} from "@/lib/repositories/loaders";
import { parseGitVersionDescriptor } from "@/lib/azure-devops/git/urls";

type RepositoryCommitsPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Commits",
};

export default async function RepositoryCommitsPage({
  params,
  searchParams,
}: RepositoryCommitsPageProps) {
  const [{ projectId, repositoryId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const context = await loadRepositoryContext(projectId, repositoryId);
  const defaultVersion = getDefaultRepositoryVersion(context.repository);

  if (!defaultVersion) {
    return <EmptyRepositoryPageState webUrl={context.repository.webUrl} />;
  }

  const version =
    parseGitVersionDescriptor(query, context.repository.defaultBranch) ??
    defaultVersion;
  const cursor = typeof query.cursor === "string" ? query.cursor : null;
  const path = typeof query.path === "string" ? query.path : null;
  const data = await loadRepositoryCommits(projectId, repositoryId, {
    cursor,
    path,
    version,
  });

  return (
    <RepositoryCommitList
      commits={data.items}
      cursor={cursor}
      nextCursor={data.nextCursor}
      path={path}
      projectId={projectId}
      repositoryId={repositoryId}
      version={version}
    />
  );
}
