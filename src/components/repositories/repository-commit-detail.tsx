import Link from "next/link";
import { ArrowLeftIcon, TriangleAlertIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AzureGitCommitChange,
  AzureGitCommitDetail,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import {
  getAzureGitChangeTypes,
  hasAzureGitChangeType,
} from "@/lib/azure-devops/git/change-types";
import {
  getRepositoryBlobHref,
  getRepositoryCommitDiffHref,
  getRepositoryCommitHref,
  getRepositoryCommitsHref,
  type RepositoryHistoryContext,
} from "@/lib/azure-devops/git/urls";
import { abbreviateCommitId, getCommitTitle } from "@/lib/repositories/format";

const CHANGES_PAGE_SIZE = 100;

function getChangeLabel(changeType: string) {
  const types = getAzureGitChangeTypes(changeType);

  if (types.has("undelete")) {
    return { label: "Restored", variant: "secondary" as const };
  }

  if (types.has("add")) {
    return { label: "Added", variant: "secondary" as const };
  }

  if (types.has("delete")) {
    return { label: "Deleted", variant: "destructive" as const };
  }

  if (
    types.has("rename") ||
    types.has("sourcerename") ||
    types.has("targetrename")
  ) {
    return { label: "Renamed", variant: "outline" as const };
  }

  return { label: "Edited", variant: "outline" as const };
}

export function RepositoryCommitDetail({
  changes,
  changesCursor,
  commit,
  nextCursor,
  projectId,
  repositoryId,
  history,
}: {
  changes: AzureGitCommitChange[];
  changesCursor: string | null;
  commit: AzureGitCommitDetail;
  nextCursor: string | null;
  projectId: string;
  repositoryId: string;
  history: RepositoryHistoryContext;
}) {
  const commitVersion: GitVersionDescriptor = {
    type: "commit",
    value: commit.commitId,
  };
  const historyUrl = new URL(
    getRepositoryCommitsHref(
      projectId,
      repositoryId,
      history.version,
      history.path ?? undefined,
    ),
    "https://better-azure-devops.local",
  );

  if (history.cursor) {
    historyUrl.searchParams.set("cursor", history.cursor);
  }

  const historyHref = `${historyUrl.pathname}?${historyUrl.searchParams}`;
  const body = commit.comment.split(/\r?\n/).slice(1).join("\n").trim();
  const changeSummary =
    Object.entries(commit.changeCounts)
      .map(([type, count]) => `${count} ${type.toLowerCase()}`)
      .join(" · ") || `${changes.length} files`;

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <Button
        className="self-start"
        nativeButton={false}
        render={<Link href={historyHref} />}
        size="sm"
        variant="ghost"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Back to {history.path ? `${history.path} history` : "history"}
      </Button>

      <section className="rounded-lg border bg-card px-3 py-2.5">
        <h1 className="font-heading text-base font-medium">
          {getCommitTitle(commit.comment)}
        </h1>
        {body ? (
          <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">
            {body}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <IdentityImage
              imageUrl={commit.author.imageUrl}
              label={commit.author.name ?? "Unknown author"}
              size="sm"
            />
            {commit.author.name ?? "Unknown author"}
          </span>
          {commit.author.date ? <DateLabel value={commit.author.date} /> : null}
          <Badge className="font-mono" variant="outline">
            {abbreviateCommitId(commit.commitId)}
          </Badge>
          {commit.parents.map((parent) => (
            <Badge
              className="font-mono"
              key={parent}
              render={
                <Link
                  href={getRepositoryCommitHref(
                    projectId,
                    repositoryId,
                    parent,
                    { history },
                  )}
                />
              }
              variant="secondary"
            >
              parent {abbreviateCommitId(parent)}
            </Badge>
          ))}
        </div>
      </section>

      {commit.tooManyChanges ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Large commit</AlertTitle>
          <AlertDescription>
            Azure DevOps reports more changes than this commit summary can
            include. Page through the remaining files below.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="overflow-hidden rounded-lg border bg-card">
        <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          {changeSummary}
        </p>
        <ol className="divide-y">
          {changes.map((change) => {
            const changeLabel = getChangeLabel(change.changeType);
            const deleted = hasAzureGitChangeType(
              change.changeType,
              "delete",
            );
            const isDiffable =
              !change.item.isFolder && change.item.gitObjectType === "blob";

            return (
              <li
                className="flex min-w-0 items-center gap-3 px-3 py-1.5 transition-colors hover:bg-muted/50"
                key={`${change.changeId}:${change.item.objectId}:${change.item.path}`}
              >
                <RepositoryPathIcon
                  kind={change.item.isFolder ? "folder" : "file"}
                  path={change.item.path}
                />
                <div className="min-w-0 flex-1">
                  {deleted ? (
                    <span className="block truncate font-mono text-xs text-muted-foreground line-through">
                      {change.item.path}
                    </span>
                  ) : (
                    <Link
                      className="block truncate font-mono text-xs hover:underline"
                      href={getRepositoryBlobHref(
                        projectId,
                        repositoryId,
                        change.item.path,
                        commitVersion,
                      )}
                    >
                      {change.item.path}
                    </Link>
                  )}
                  {change.originalPath ? (
                    <p className="truncate text-xs text-muted-foreground">
                      from {change.originalPath}
                    </p>
                  ) : null}
                </div>
                <Badge className="shrink-0" variant={changeLabel.variant}>
                  {changeLabel.label}
                </Badge>
                {isDiffable ? (
                  <Button
                    className="shrink-0"
                    nativeButton={false}
                    render={
                      <Link
                        href={getRepositoryCommitDiffHref(
                          projectId,
                          repositoryId,
                          commit.commitId,
                          change.item.path,
                          {
                            basePath: change.originalPath,
                            changesCursor,
                            history,
                          },
                        )}
                      />
                    }
                    size="xs"
                    variant="ghost"
                  >
                    Diff
                  </Button>
                ) : null}
              </li>
            );
          })}
          {changes.length === 0 ? (
            <li className="px-3 py-10 text-center text-sm text-muted-foreground">
              This commit has no visible file changes.
            </li>
          ) : null}
        </ol>
      </div>

      <RepositoryPager
        buildHref={(pageCursor) =>
          getRepositoryCommitHref(projectId, repositoryId, commit.commitId, {
            changesCursor: pageCursor,
            history,
          })
        }
        cursor={changesCursor}
        label="Changed file pages"
        newerLabel="Previous files"
        nextCursor={nextCursor}
        olderLabel="Next files"
        pageSize={CHANGES_PAGE_SIZE}
      />
    </div>
  );
}
