import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RepositoryActions } from "@/components/repositories/repository-actions";
import { RepositoryToolbar } from "@/components/repositories/repository-toolbar";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import {
  loadActivePullRequestCount,
  loadRepositoryContext,
} from "@/lib/repositories/loaders";

type RepositoryLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    projectId: string;
    repositoryId: string;
  }>;
};

export default async function RepositoryLayout({
  children,
  params,
}: RepositoryLayoutProps) {
  const { projectId, repositoryId } = await params;
  let context;

  try {
    context = await loadRepositoryContext(projectId, repositoryId);
  } catch (error) {
    if (describeAzureDevOpsError(error).kind === "not-found") {
      notFound();
    }

    throw error;
  }

  const { repository } = context;
  const statusBadges = [
    repository.isFork ? { label: "Fork", variant: "secondary" as const } : null,
    repository.isDisabled
      ? { label: "Disabled", variant: "destructive" as const }
      : null,
    repository.isInMaintenance
      ? { label: "Maintenance", variant: "outline" as const }
      : null,
  ].filter((badge) => badge !== null);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader
        actions={
          <>
            <RepositoryActions repository={repository} />
            <ThemeToggle />
          </>
        }
        items={[
          { href: "/repos", label: "Repositories" },
          { label: repository.project.name },
          {
            action:
              statusBadges.length > 0 ? (
                <span className="flex items-center gap-1">
                  {statusBadges.map((badge) => (
                    <Badge key={badge.label} variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  ))}
                </span>
              ) : undefined,
            label: repository.name,
          },
        ]}
      />
      {repository.defaultBranch ? (
        <Suspense fallback={<div className="h-10 shrink-0 border-b" />}>
          <RepositoryToolbarSection
            defaultBranch={repository.defaultBranch}
            projectId={projectId}
            refs={context.refs}
            repositoryId={repositoryId}
          />
        </Suspense>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

async function RepositoryToolbarSection({
  defaultBranch,
  projectId,
  refs,
  repositoryId,
}: {
  defaultBranch: string;
  projectId: string;
  refs: Awaited<ReturnType<typeof loadRepositoryContext>>["refs"];
  repositoryId: string;
}) {
  const pullRequestCount = await loadActivePullRequestCount(
    projectId,
    repositoryId,
  );

  return (
    <RepositoryToolbar
      branches={refs.branches}
      branchesTruncated={refs.branchesTruncated}
      defaultBranch={defaultBranch}
      projectId={projectId}
      pullRequestCount={pullRequestCount}
      repositoryId={repositoryId}
      tags={refs.tags}
      tagsTruncated={refs.tagsTruncated}
    />
  );
}
