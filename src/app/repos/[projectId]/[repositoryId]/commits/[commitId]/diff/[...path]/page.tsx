import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepositoryCommitFileDiff } from "@/components/repositories/repository-commit-file-diff";
import {
  getDefaultRepositoryVersion,
  loadRepositoryCommitFileDiff,
} from "@/lib/repositories/loaders";
import { preloadRepositoryDiff } from "@/lib/repositories/pierre-diff-server";
import {
  getRepositoryCommitHref,
  normalizeRepositoryPath,
  parseGitVersionDescriptor,
  type RepositoryHistoryContext,
} from "@/lib/azure-devops/git/urls";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";

type RepositoryCommitDiffPageProps = {
  params: Promise<{
    commitId: string;
    path: string[];
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: RepositoryCommitDiffPageProps): Promise<Metadata> {
  const { commitId, path } = await params;

  return {
    title: `${path.at(-1) ?? "File"} · ${commitId.slice(0, 8)}`,
  };
}

export default async function RepositoryCommitDiffPage({
  params,
  searchParams,
}: RepositoryCommitDiffPageProps) {
  const [{ commitId, path: pathSegments, projectId, repositoryId }, query] =
    await Promise.all([params, searchParams]);
  const path = normalizeRepositoryPath(pathSegments.join("/"));
  const basePath =
    typeof query.basePath === "string"
      ? normalizeRepositoryPath(query.basePath)
      : null;
  const changesCursor =
    typeof query.changesCursor === "string" ? query.changesCursor : null;
  let data;

  try {
    data = await loadRepositoryCommitFileDiff(
      projectId,
      repositoryId,
      commitId,
      path,
      basePath,
    );
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      notFound();
    }

    throw error;
  }

  if (data.before.kind === "missing" && data.after.kind === "missing") {
    notFound();
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
  const diff =
    (data.before.kind === "text" || data.before.kind === "missing") &&
    (data.after.kind === "text" || data.after.kind === "missing")
      ? await preloadRepositoryDiff(
          {
            contents: data.before.content ?? "",
            name: data.before.path,
          },
          {
            contents: data.after.content ?? "",
            name: data.after.path,
          },
        )
      : null;
  const commitHref = getRepositoryCommitHref(
    projectId,
    repositoryId,
    data.commit.commitId,
    { changesCursor, history },
  );

  return (
    <RepositoryCommitFileDiff
      after={data.after}
      before={data.before}
      commitHref={commitHref}
      diff={diff}
      path={path}
      projectId={projectId}
      repositoryId={repositoryId}
      version={{
        type: "commit",
        value: data.commit.commitId,
      }}
    />
  );
}
