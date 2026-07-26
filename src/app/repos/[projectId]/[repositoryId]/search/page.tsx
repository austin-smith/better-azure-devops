import type { Metadata } from "next";
import { RepositorySearchResults } from "@/components/repositories/repository-search-results";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import {
  getDefaultRepositoryVersion,
  loadRepositoryContext,
  loadRepositorySearch,
} from "@/lib/repositories/loaders";
import { parseGitVersionDescriptor } from "@/lib/azure-devops/git/urls";

type RepositorySearchPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Search code",
};

export default async function RepositorySearchPage({
  params,
  searchParams,
}: RepositorySearchPageProps) {
  const [{ projectId, repositoryId }, urlQuery] = await Promise.all([
    params,
    searchParams,
  ]);
  const context = await loadRepositoryContext(projectId, repositoryId);
  const defaultVersion = getDefaultRepositoryVersion(context.repository);

  if (!defaultVersion) {
    return <EmptyRepositoryPageState webUrl={context.repository.webUrl} />;
  }

  const version =
    parseGitVersionDescriptor(
      urlQuery,
      context.repository.defaultBranch,
    ) ?? defaultVersion;
  const searchVersion =
    version.type === "branch" ? version : defaultVersion;
  const query = typeof urlQuery.q === "string" ? urlQuery.q.trim() : "";
  const cursor =
    typeof urlQuery.cursor === "string" ? urlQuery.cursor : null;
  const result = query
      ? await loadRepositorySearch(projectId, repositoryId, {
        branch: searchVersion.value,
        cursor,
        query,
      })
    : {
        infoCode: null,
        items: [],
        nextCursor: null,
        totalCount: 0,
      };

  return (
    <RepositorySearchResults
      cursor={cursor}
      infoCode={result.infoCode}
      nextCursor={result.nextCursor}
      projectId={projectId}
      query={query}
      requestedVersion={version}
      repositoryId={repositoryId}
      results={result.items}
      totalCount={result.totalCount}
      version={searchVersion}
    />
  );
}
