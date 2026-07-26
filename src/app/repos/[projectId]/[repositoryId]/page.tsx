import type { Metadata } from "next";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import { RepositoryDirectory } from "@/components/repositories/repository-directory";
import { RepositoryReadme } from "@/components/repositories/repository-readme";
import {
  getDefaultRepositoryVersion,
  loadRepositoryContext,
  loadRepositoryOverview,
} from "@/lib/repositories/loaders";
import { parseGitVersionDescriptor } from "@/lib/azure-devops/git/urls";

type RepositoryOverviewPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RepositoryOverviewPageProps): Promise<Metadata> {
  const { projectId, repositoryId } = await params;
  const { repository } = await loadRepositoryContext(projectId, repositoryId);

  return {
    title: repository.name,
    description: `Browse ${repository.project.name}/${repository.name}`,
  };
}

export default async function RepositoryOverviewPage({
  params,
  searchParams,
}: RepositoryOverviewPageProps) {
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
  const overview = await loadRepositoryOverview(
    projectId,
    repositoryId,
    version,
  );

  return (
    <RepositoryDirectory
      items={overview.items}
      latestCommit={overview.commits[0] ?? null}
      path="/"
      projectId={projectId}
      repositoryId={repositoryId}
      version={version}
    >
      {overview.readme ? (
        <RepositoryReadme
          item={overview.readme}
          projectId={projectId}
          repositoryId={repositoryId}
          version={version}
        />
      ) : null}
    </RepositoryDirectory>
  );
}
