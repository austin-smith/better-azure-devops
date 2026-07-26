import Link from "next/link";
import { GitCommitHorizontalIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { Badge } from "@/components/ui/badge";
import { getRepositoryCommitHref } from "@/lib/azure-devops/git/urls";
import type { AzureGitPullRequestIteration } from "@/lib/azure-devops/git/types";
import { abbreviateCommitId } from "@/lib/repositories/format";

export function RepositoryPullRequestUpdates({
  iterations,
  sourceRepository,
}: {
  iterations: AzureGitPullRequestIteration[];
  sourceRepository: {
    id: string;
    projectId: string;
  };
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b bg-muted/30 px-3 py-2 text-sm font-medium">
        Updates
      </h2>
      {iterations.length === 0 ? (
        <p className="px-3 py-10 text-center text-sm text-muted-foreground">
          No iteration history is available for this pull request.
        </p>
      ) : (
        <ol className="divide-y">
          {[...iterations].reverse().map((iteration) => (
            <li className="flex items-start gap-3 p-3" key={iteration.id}>
              {iteration.author ? (
                <IdentityImage
                  imageUrl={iteration.author.imageUrl}
                  label={iteration.author.displayName}
                  size="sm"
                />
              ) : (
                <GitCommitHorizontalIcon className="mt-1 size-4 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    Update {iteration.id}
                  </span>
                  <Badge variant="outline">{iteration.reason}</Badge>
                  {iteration.createdDate ? (
                    <DateLabel
                      className="text-xs text-muted-foreground"
                      value={iteration.createdDate}
                    />
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {iteration.description ||
                    `${iteration.author?.displayName ?? "A contributor"} updated the source branch.`}
                </p>
                {iteration.sourceRefCommitId ? (
                  <Link
                    className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                    href={getRepositoryCommitHref(
                      sourceRepository.projectId,
                      sourceRepository.id,
                      iteration.sourceRefCommitId,
                    )}
                  >
                    <GitCommitHorizontalIcon className="size-3.5" />
                    {abbreviateCommitId(iteration.sourceRefCommitId)}
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
