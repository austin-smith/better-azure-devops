import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepositoryDirectory } from "@/components/repositories/repository-directory";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import {
  getDefaultRepositoryVersion,
  loadRepositoryContext,
  loadRepositoryDirectory,
} from "@/lib/repositories/loaders";
import {
  normalizeRepositoryPath,
  parseGitVersionDescriptor,
} from "@/lib/azure-devops/git/urls";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";

type RepositoryTreePageProps = {
  params: Promise<{
    path?: string[];
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RepositoryTreePageProps): Promise<Metadata> {
  const { path, projectId, repositoryId } = await params;
  const { repository } = await loadRepositoryContext(projectId, repositoryId);
  const directory = path?.at(-1);

  return {
    title: directory ? `${directory} · ${repository.name}` : repository.name,
  };
}

export default async function RepositoryTreePage({
  params,
  searchParams,
}: RepositoryTreePageProps) {
  const [{ path: pathSegments, projectId, repositoryId }, query] =
    await Promise.all([params, searchParams]);
  const context = await loadRepositoryContext(projectId, repositoryId);
  const defaultVersion = getDefaultRepositoryVersion(context.repository);

  if (!defaultVersion) {
    return <EmptyRepositoryPageState webUrl={context.repository.webUrl} />;
  }

  const version =
    parseGitVersionDescriptor(query, context.repository.defaultBranch) ??
    defaultVersion;
  const path = normalizeRepositoryPath(pathSegments?.join("/") ?? "/");
  let directory;

  try {
    directory = await loadRepositoryDirectory(
      projectId,
      repositoryId,
      path,
      version,
    );
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      notFound();
    }

    throw error;
  }

  return (
    <RepositoryDirectory
      items={directory.items}
      latestCommit={directory.latestCommit}
      path={path}
      projectId={projectId}
      repositoryId={repositoryId}
      version={version}
    />
  );
}
