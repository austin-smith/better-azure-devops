import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RepositoryBlob } from "@/components/repositories/repository-blob";
import {
  getDefaultRepositoryVersion,
  loadRepositoryBlob,
  loadRepositoryContext,
} from "@/lib/repositories/loaders";
import {
  getRepositoryTreeHref,
  normalizeRepositoryPath,
  parseGitVersionDescriptor,
} from "@/lib/azure-devops/git/urls";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import { preloadRepositoryFile } from "@/lib/repositories/pierre-file-server";

type RepositoryBlobPageProps = {
  params: Promise<{
    path: string[];
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RepositoryBlobPageProps): Promise<Metadata> {
  const { path, projectId, repositoryId } = await params;
  const { repository } = await loadRepositoryContext(projectId, repositoryId);

  return {
    title: `${path.at(-1) ?? "File"} · ${repository.name}`,
  };
}

export default async function RepositoryBlobPage({
  params,
  searchParams,
}: RepositoryBlobPageProps) {
  const [{ path: pathSegments, projectId, repositoryId }, query] =
    await Promise.all([params, searchParams]);
  const context = await loadRepositoryContext(projectId, repositoryId);
  const defaultVersion = getDefaultRepositoryVersion(context.repository);

  if (!defaultVersion) {
    notFound();
  }

  const version =
    parseGitVersionDescriptor(query, context.repository.defaultBranch) ??
    defaultVersion;
  const path = normalizeRepositoryPath(pathSegments.join("/"));
  let blob;

  try {
    blob = await loadRepositoryBlob(
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

  if (blob.kind === "folder") {
    redirect(
      getRepositoryTreeHref(projectId, repositoryId, path, version),
    );
  }
  const preloadedFile =
    blob.kind === "text" && blob.item.content !== null
      ? await preloadRepositoryFile({
          contents: blob.item.content,
          name: path,
        })
      : null;

  return (
    <RepositoryBlob
      item={blob.item}
      kind={blob.kind}
      path={path}
      preloadedFile={preloadedFile}
      projectId={projectId}
      repositoryId={repositoryId}
      version={version}
    />
  );
}
