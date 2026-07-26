import Link from "next/link";
import { CornerLeftUpIcon, HistoryIcon } from "lucide-react";
import { DateLabel } from "@/components/date-label";
import { IdentityImage } from "@/components/identity-image";
import { RepositoryPathBreadcrumb } from "@/components/repositories/repository-path-breadcrumb";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AzureGitCommitSummary,
  AzureGitItem,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryBlobHref,
  getRepositoryCommitHref,
  getRepositoryCommitsHref,
  getRepositoryTreeHref,
  normalizeRepositoryPath,
} from "@/lib/azure-devops/git/urls";
import { abbreviateCommitId, getCommitTitle } from "@/lib/repositories/format";

function sortItems(items: readonly AzureGitItem[]) {
  return [...items].sort((left, right) => {
    if (left.isFolder !== right.isFolder) {
      return left.isFolder ? -1 : 1;
    }

    return left.path.localeCompare(right.path, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getParentPath(path: string) {
  const segments = normalizeRepositoryPath(path).split("/").filter(Boolean);

  segments.pop();

  return segments.length ? `/${segments.join("/")}` : "/";
}

export function RepositoryFileList({
  items,
  latestCommit,
  path,
  projectId,
  repositoryId,
  version,
}: {
  items: AzureGitItem[];
  latestCommit: AzureGitCommitSummary | null;
  path: string;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const normalizedPath = normalizeRepositoryPath(path);
  const orderedItems = sortItems(items);
  const history = { path: normalizedPath, version };

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex min-w-0 items-center gap-2 border-b px-3 py-1.5">
        <RepositoryPathBreadcrumb
          className="min-w-0 flex-1"
          path={normalizedPath}
          projectId={projectId}
          repositoryId={repositoryId}
          version={version}
        />
        <Button
          className="shrink-0"
          nativeButton={false}
          render={
            <Link
              href={getRepositoryCommitsHref(
                projectId,
                repositoryId,
                version,
                normalizedPath,
              )}
            />
          }
          size="sm"
          variant="ghost"
        >
          <HistoryIcon data-icon="inline-start" />
          History
        </Button>
      </div>

      {latestCommit ? (
        <div className="flex min-w-0 items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs">
          <IdentityImage
            className="shrink-0"
            imageUrl={latestCommit.author.imageUrl}
            label={latestCommit.author.name ?? "Unknown author"}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-medium">
              {latestCommit.author.name ?? "Unknown author"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              {getCommitTitle(latestCommit.comment)}
            </span>
          </span>
          <Link
            className="shrink-0 font-mono text-muted-foreground hover:text-foreground"
            href={getRepositoryCommitHref(
              projectId,
              repositoryId,
              latestCommit.commitId,
              { history },
            )}
          >
            {abbreviateCommitId(latestCommit.commitId)}
          </Link>
          {latestCommit.author.date ? (
            <DateLabel
              className="hidden shrink-0 text-muted-foreground sm:inline"
              value={latestCommit.author.date}
            />
          ) : null}
        </div>
      ) : null}

      <Table>
        <TableHeader className="sr-only">
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Latest change</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {normalizedPath !== "/" ? (
            <TableRow>
              <TableCell className="px-3 py-1.5" colSpan={3}>
                <Link
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                  href={getRepositoryTreeHref(
                    projectId,
                    repositoryId,
                    getParentPath(normalizedPath),
                    version,
                  )}
                >
                  <CornerLeftUpIcon className="size-4" />
                  <span className="font-mono">..</span>
                </Link>
              </TableCell>
            </TableRow>
          ) : null}
          {orderedItems.map((item) => {
            const name = item.path.split("/").pop() ?? item.path;
            const href = item.isFolder
              ? getRepositoryTreeHref(
                  projectId,
                  repositoryId,
                  item.path,
                  version,
                )
              : getRepositoryBlobHref(
                  projectId,
                  repositoryId,
                  item.path,
                  version,
                );

            return (
              <TableRow key={item.path}>
                <TableCell className="w-1/2 px-3 py-1.5">
                  <Link
                    className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                    href={href}
                  >
                    <RepositoryPathIcon
                      kind={item.isFolder ? "folder" : "file"}
                      path={item.path}
                    />
                    <span className="truncate">{name}</span>
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-0 px-3 py-1.5 text-xs text-muted-foreground md:table-cell">
                  {item.latestChange ? (
                    <Link
                      className="block truncate hover:text-foreground hover:underline"
                      href={getRepositoryCommitHref(
                        projectId,
                        repositoryId,
                        item.latestChange.commitId,
                        { history },
                      )}
                    >
                      {getCommitTitle(item.latestChange.comment)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden w-28 px-3 py-1.5 text-right text-xs whitespace-nowrap text-muted-foreground sm:table-cell">
                  {item.latestChange?.author.date ? (
                    <DateLabel value={item.latestChange.author.date} />
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {orderedItems.length === 0 ? (
            <TableRow>
              <TableCell
                className="px-3 py-10 text-center text-sm text-muted-foreground"
                colSpan={3}
              >
                This directory is empty.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  );
}
