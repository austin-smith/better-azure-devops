import Link from "next/link";
import { GitCommitHorizontalIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { getRepositoryCommitHref } from "@/lib/azure-devops/git/urls";
import type { AzureGitCommitSummary } from "@/lib/azure-devops/git/types";
import { abbreviateCommitId, getCommitTitle } from "@/lib/repositories/format";

export function RepositoryPullRequestCommits({
  commits,
  sourceRepository,
}: {
  commits: AzureGitCommitSummary[];
  sourceRepository: {
    id: string;
    projectId: string;
  };
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
        Commits
      </h2>
      {commits.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          Commit details are not available.
        </p>
      ) : (
        <ol className="divide-y">
          {commits.map((commit) => (
            <li key={commit.commitId}>
              <Link
                className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                href={getRepositoryCommitHref(
                  sourceRepository.projectId,
                  sourceRepository.id,
                  commit.commitId,
                )}
              >
                <GitCommitHorizontalIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {getCommitTitle(commit.comment)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {commit.author.name ?? "Unknown author"}
                    {commit.author.date ? (
                      <>
                        {" "}
                        · <DateLabel value={commit.author.date} />
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {abbreviateCommitId(commit.commitId)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
