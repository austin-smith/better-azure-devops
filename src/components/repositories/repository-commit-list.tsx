import Link from "next/link";
import { GitCommitHorizontalIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { RepositoryPathBreadcrumb } from "@/components/repositories/repository-path-breadcrumb";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  AzureGitCommitSummary,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryCommitHref,
  getRepositoryCommitsHref,
} from "@/lib/azure-devops/git/urls";
import { abbreviateCommitId, getCommitTitle } from "@/lib/repositories/format";

const COMMIT_PAGE_SIZE = 50;

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function groupByDay(commits: AzureGitCommitSummary[]) {
  const groups: Array<{ day: string; commits: AzureGitCommitSummary[] }> = [];

  for (const commit of commits) {
    const day = commit.author.date
      ? dayFormatter.format(new Date(commit.author.date))
      : "Unknown date";
    const current = groups.at(-1);

    if (current?.day === day) {
      current.commits.push(commit);
    } else {
      groups.push({ commits: [commit], day });
    }
  }

  return groups;
}

export function RepositoryCommitList({
  commits,
  cursor,
  nextCursor,
  path,
  projectId,
  repositoryId,
  version,
}: {
  commits: AzureGitCommitSummary[];
  cursor: string | null;
  nextCursor: string | null;
  path: string | null;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const history = { cursor, path, version };
  const groups = groupByDay(commits);

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      {path ? (
        <RepositoryPathBreadcrumb
          path={path}
          projectId={projectId}
          repositoryId={repositoryId}
          version={version}
        />
      ) : null}

      {commits.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GitCommitHorizontalIcon />
            </EmptyMedia>
            <EmptyTitle>No commits found</EmptyTitle>
            <EmptyDescription>
              Nothing was committed on {version.value}
              {path ? ` under ${path}` : ""}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          {groups.map((group) => (
            <section key={group.day}>
              <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {group.day}
              </h2>
              <ol className="divide-y">
                {group.commits.map((commit) => {
                  const commitHref = getRepositoryCommitHref(
                    projectId,
                    repositoryId,
                    commit.commitId,
                    { history },
                  );

                  return (
                    <li
                      className="flex min-w-0 items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted/50"
                      key={commit.commitId}
                    >
                      <IdentityImage
                        className="shrink-0"
                        imageUrl={commit.author.imageUrl}
                        label={commit.author.name ?? "Unknown author"}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          className="block truncate text-sm font-medium hover:underline"
                          href={commitHref}
                        >
                          {getCommitTitle(commit.comment)}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {commit.author.name ?? "Unknown author"}
                          {commit.author.date ? (
                            <>
                              {" committed "}
                              <DateLabel value={commit.author.date} />
                            </>
                          ) : null}
                        </p>
                      </div>
                      <Badge
                        className="shrink-0 font-mono"
                        render={<Link href={commitHref} />}
                        variant="outline"
                      >
                        {abbreviateCommitId(commit.commitId)}
                      </Badge>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <RepositoryPager
        buildHref={(pageCursor) => {
          const href = getRepositoryCommitsHref(
            projectId,
            repositoryId,
            version,
            path ?? undefined,
          );

          return pageCursor
            ? `${href}&cursor=${encodeURIComponent(pageCursor)}`
            : href;
        }}
        cursor={cursor}
        label="Commit pages"
        newerLabel="Newer"
        nextCursor={nextCursor}
        olderLabel="Older"
        pageSize={COMMIT_PAGE_SIZE}
      />
    </div>
  );
}
