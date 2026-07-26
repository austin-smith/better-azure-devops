import type { Metadata } from "next";
import { RepositoryPushActivity } from "@/components/repositories/repository-push-activity";
import { EmptyRepositoryPageState } from "@/components/repositories/repository-state";
import {
  getDefaultRepositoryVersion,
  loadRepositoryContext,
  loadRepositoryPushActivity,
} from "@/lib/repositories/loaders";
import {
  getGitVersionRefName,
  parseGitVersionDescriptor,
} from "@/lib/azure-devops/git/urls";

type RepositoryActivityPageProps = {
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Push activity",
};

export default async function RepositoryActivityPage({
  params,
  searchParams,
}: RepositoryActivityPageProps) {
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
  const data = await loadRepositoryPushActivity(projectId, repositoryId, {
    cursor,
    refName: getGitVersionRefName(version),
  });

  return (
    <RepositoryPushActivity
      cursor={cursor}
      items={data.items}
      nextCursor={data.nextCursor}
      projectId={projectId}
      repositoryId={repositoryId}
      version={version}
    />
  );
}
