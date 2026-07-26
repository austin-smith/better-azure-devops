import Link from "next/link";
import {
  ExternalLinkIcon,
  GitBranchIcon,
  UploadIcon,
} from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  AzureGitPush,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryCommitHref,
  getRepositoryHref,
  getRepositoryTreeHref,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";
import { abbreviateCommitId, getCommitTitle } from "@/lib/repositories/format";

const ACTIVITY_PAGE_SIZE = 25;
const ZERO_OBJECT_ID = "0000000000000000000000000000000000000000";

function getActivityPageHref(
  projectId: string,
  repositoryId: string,
  version: GitVersionDescriptor,
  cursor?: string | null,
) {
  const searchParams = new URLSearchParams({
    version: version.value,
    versionType: version.type,
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return `${getRepositoryHref(projectId, repositoryId)}/activity?${searchParams}`;
}

function getRefUpdateLabel(
  oldObjectId: string | null,
  newObjectId: string | null,
) {
  if (oldObjectId === ZERO_OBJECT_ID) {
    return "created";
  }

  if (newObjectId === ZERO_OBJECT_ID) {
    return "deleted";
  }

  return "updated";
}

export function RepositoryPushActivity({
  cursor,
  items,
  nextCursor,
  projectId,
  repositoryId,
  version,
}: {
  cursor: string | null;
  items: AzureGitPush[];
  nextCursor: string | null;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      {version.type === "branch" ? null : (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Azure DevOps filters push activity by branch only, so these pushes
          span every ref rather than the selected {version.type}.
        </p>
      )}

      {items.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UploadIcon />
            </EmptyMedia>
            <EmptyTitle>No push activity found</EmptyTitle>
            <EmptyDescription>
              No matching pushes are visible on this page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((push) => (
            <li
              className="overflow-hidden rounded-lg border bg-card"
              key={push.pushId}
            >
              <div className="flex min-w-0 items-center gap-2.5 border-b bg-muted/30 px-3 py-2">
                {push.pushedBy ? (
                  <IdentityImage
                    className="shrink-0"
                    imageUrl={push.pushedBy.imageUrl}
                    label={push.pushedBy.displayName}
                    size="sm"
                  />
                ) : (
                  <UploadIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">
                    {push.pushedBy?.displayName ?? "Unknown pusher"}
                  </span>
                  <span className="text-muted-foreground">
                    {" pushed "}
                    {push.commits.length}
                    {push.commitsTruncated ? "+" : ""}{" "}
                    {push.commits.length === 1 ? "commit" : "commits"}
                    {push.date ? " " : null}
                  </span>
                  {push.date ? (
                    <DateLabel
                      className="text-muted-foreground"
                      value={push.date}
                    />
                  ) : null}
                </p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {push.refUpdates.map((update) => {
                    const branch = stripRefPrefix(update.name);
                    const deleted = update.newObjectId === ZERO_OBJECT_ID;

                    return (
                      <Badge
                        className="font-mono"
                        key={`${push.pushId}:${update.name}`}
                        render={
                          deleted ? undefined : (
                            <Link
                              href={getRepositoryTreeHref(
                                projectId,
                                repositoryId,
                                "/",
                                {
                                  type: update.name.startsWith("refs/tags/")
                                    ? "tag"
                                    : "branch",
                                  value: branch,
                                },
                              )}
                            />
                          )
                        }
                        variant="outline"
                      >
                        <GitBranchIcon />
                        {branch}
                        <span className="text-muted-foreground">
                          {getRefUpdateLabel(
                            update.oldObjectId,
                            update.newObjectId,
                          )}
                        </span>
                      </Badge>
                    );
                  })}
                  {push.webUrl ? (
                    <Button
                      aria-label={`Open push ${push.pushId} in Azure DevOps`}
                      nativeButton={false}
                      render={
                        <Link
                          href={push.webUrl}
                          rel="noreferrer"
                          target="_blank"
                        />
                      }
                      size="icon-xs"
                      variant="ghost"
                    >
                      <ExternalLinkIcon />
                    </Button>
                  ) : null}
                </div>
              </div>

              {push.commits.length > 0 ? (
                <ol className="divide-y">
                  {push.commits.map((commit) => (
                    <li
                      className="flex min-w-0 items-center gap-3 px-3 py-1.5 transition-colors hover:bg-muted/50"
                      key={commit.commitId}
                    >
                      <Link
                        className="min-w-0 flex-1 truncate text-sm hover:underline"
                        href={getRepositoryCommitHref(
                          projectId,
                          repositoryId,
                          commit.commitId,
                          { history: { version } },
                        )}
                      >
                        {getCommitTitle(commit.comment)}
                      </Link>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {abbreviateCommitId(commit.commitId)}
                      </span>
                    </li>
                  ))}
                  {push.commitsTruncated ? (
                    <li className="px-3 py-2 text-xs text-muted-foreground">
                      Showing the first {push.commits.length} commits from this
                      push.
                    </li>
                  ) : null}
                </ol>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      <RepositoryPager
        buildHref={(pageCursor) =>
          getActivityPageHref(projectId, repositoryId, version, pageCursor)
        }
        cursor={cursor}
        label="Push activity pages"
        newerLabel="Newer"
        nextCursor={nextCursor}
        olderLabel="Older"
        pageSize={ACTIVITY_PAGE_SIZE}
      />
    </div>
  );
}
