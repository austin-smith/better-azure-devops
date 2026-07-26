import Link from "next/link";
import { ArrowLeftIcon, FileWarningIcon } from "lucide-react";
import { RepositoryMultiFileDiff } from "@/components/repositories/repository-multi-file-diff";
import { RepositoryPathBreadcrumb } from "@/components/repositories/repository-path-breadcrumb";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";
import type { RepositoryPreloadedDiff } from "@/lib/repositories/pierre-diff-server";

type DiffFile = {
  kind:
    | "binary"
    | "folder"
    | "image"
    | "missing"
    | "submodule"
    | "text"
    | "too-large";
  path: string;
  size: number | null;
};

function getUnavailableDescription(file: DiffFile) {
  switch (file.kind) {
    case "binary":
      return `${file.path} is binary and cannot be rendered as a text diff.`;
    case "folder":
      return `${file.path} resolves to a directory.`;
    case "image":
      return `${file.path} is an image and cannot be rendered as a text diff.`;
    case "submodule":
      return `${file.path} is a Git submodule reference rather than a text file.`;
    case "too-large":
      return `${file.path} exceeds the safe inline diff limit.`;
    default:
      return `${file.path} is unavailable at this commit.`;
  }
}

function getComparisonDescription(before: DiffFile, after: DiffFile) {
  if (before.kind === "missing") {
    return "New file in this commit";
  }

  if (after.kind === "missing") {
    return "Deleted in this commit";
  }

  return before.path === after.path
    ? "Compared with the first parent commit"
    : `Renamed from ${before.path}`;
}

export function RepositoryCommitFileDiff({
  after,
  before,
  commitHref,
  diff,
  path,
  projectId,
  repositoryId,
  version,
}: {
  after: DiffFile;
  before: DiffFile;
  commitHref: string;
  diff:
    | {
        additions: number;
        deletions: number;
        kind: "ready";
        lineCount: number;
        preloadedDiff: RepositoryPreloadedDiff;
      }
    | {
        additions: number;
        deletions: number;
        kind: "too-large";
        lineCount: number;
      }
    | null;
  path: string;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const unavailableFile = [before, after].find(
    (file) => file.kind !== "text" && file.kind !== "missing",
  );

  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <RepositoryPathBreadcrumb
          className="min-w-0 flex-1"
          path={path}
          projectId={projectId}
          repositoryId={repositoryId}
          version={version}
        />
        <Button
          className="shrink-0"
          nativeButton={false}
          render={<Link href={commitHref} />}
          size="sm"
          variant="outline"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to commit
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <RepositoryPathIcon
              kind={unavailableFile?.kind === "folder" ? "folder" : "file"}
              path={path}
            />
            <span className="truncate font-mono text-sm">{path}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {getComparisonDescription(before, after)}
            </span>
          </div>
          {diff ? (
            <div className="flex shrink-0 items-center gap-1.5 font-mono">
              <Badge variant="secondary">+{diff.additions}</Badge>
              <Badge variant="destructive">−{diff.deletions}</Badge>
            </div>
          ) : null}
        </header>
        <div>
          {unavailableFile ? (
            <div className="p-4">
              <Alert>
                <FileWarningIcon />
                <AlertTitle>Text diff unavailable</AlertTitle>
                <AlertDescription>
                  {getUnavailableDescription(unavailableFile)}
                </AlertDescription>
              </Alert>
            </div>
          ) : diff?.kind === "too-large" ? (
            <div className="p-4">
              <Alert>
                <FileWarningIcon />
                <AlertTitle>Diff is too large to preview</AlertTitle>
                <AlertDescription>
                  This change would render {diff.lineCount.toLocaleString()}{" "}
                  lines, exceeding the safe inline diff limit. Open the file
                  in Azure DevOps or download it to inspect the complete change.
                </AlertDescription>
              </Alert>
            </div>
          ) : diff?.kind === "ready" ? (
            <>
              <RepositoryMultiFileDiff
                ariaLabel={`Changes to ${path}`}
                {...diff.preloadedDiff}
              />
              {diff.additions === 0 && diff.deletions === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No textual differences were found.
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
