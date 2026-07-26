import Link from "next/link";
import {
  DownloadIcon,
  FileArchiveIcon,
  FileWarningIcon,
} from "lucide-react";
import { RepositoryCodeViewer } from "@/components/repositories/repository-code-viewer";
import { RepositoryContentImage } from "@/components/repositories/repository-content-image";
import { RepositoryMarkdown } from "@/components/repositories/repository-markdown";
import { RepositoryPathBreadcrumb } from "@/components/repositories/repository-path-breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type {
  AzureGitItem,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryBlobHref,
  getRepositoryContentHref,
} from "@/lib/azure-devops/git/urls";
import { formatRepositorySize } from "@/lib/repositories/format";
import type { RepositoryPreloadedFile } from "@/lib/repositories/pierre-file-server";

type BlobKind =
  | "binary"
  | "image"
  | "markdown"
  | "submodule"
  | "text"
  | "too-large";

export function RepositoryBlob({
  item,
  kind,
  path,
  preloadedFile,
  projectId,
  repositoryId,
  version,
}: {
  item: AzureGitItem;
  kind: BlobKind;
  path: string;
  preloadedFile: {
    fullContent: string | null;
    isTruncated: boolean;
    lineCount: number;
    preloadedFile: RepositoryPreloadedFile;
  } | null;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const fileName = path.split("/").pop() ?? path;
  const contentHref = getRepositoryContentHref(
    projectId,
    repositoryId,
    path,
    version,
  );
  const downloadHref = getRepositoryContentHref(
    projectId,
    repositoryId,
    path,
    version,
    { download: true },
  );
  const permalinkCommitId =
    item.commitId ?? (version.type === "commit" ? version.value : null);
  const permalinkHref = permalinkCommitId
    ? getRepositoryBlobHref(projectId, repositoryId, path, {
        type: "commit",
        value: permalinkCommitId,
      })
    : null;

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
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatRepositorySize(item.size)}
        </span>
        {kind !== "submodule" ? (
          <Button
            className="shrink-0"
            nativeButton={false}
            render={<Link download={fileName} href={downloadHref} />}
            size="sm"
            variant="outline"
          >
            <DownloadIcon data-icon="inline-start" />
            Download
          </Button>
        ) : null}
      </div>

      {kind === "markdown" && item.content !== null ? (
        <section className="overflow-hidden rounded-lg border bg-card">
          <RepositoryMarkdown
            content={item.content}
            path={path}
            projectId={projectId}
            repositoryId={repositoryId}
            version={version}
          />
        </section>
      ) : kind === "text" && item.content !== null && preloadedFile ? (
        <RepositoryCodeViewer
          downloadHref={downloadHref}
          fileName={fileName}
          permalinkHref={permalinkHref}
          sourceKey={item.objectId}
          {...preloadedFile}
        />
      ) : kind === "image" ? (
        <section className="flex min-h-80 items-center justify-center overflow-auto rounded-lg border bg-[linear-gradient(45deg,var(--muted)_25%,transparent_25%),linear-gradient(-45deg,var(--muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--muted)_75%),linear-gradient(-45deg,transparent_75%,var(--muted)_75%)] bg-[size:20px_20px] bg-[position:0_0,0_10px,10px_-10px,-10px_0] p-6">
          {/* The checkerboard exists so transparency reads accurately, so the
              file itself is shown unaltered: rounding would clip real pixels
              and a shadow would darken its edges. Only height is bounded. */}
          <RepositoryContentImage
            alt={fileName}
            className="max-h-[72vh]"
            src={contentHref}
          />
        </section>
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {kind === "too-large" ? (
                <FileWarningIcon />
              ) : (
                <FileArchiveIcon />
              )}
            </EmptyMedia>
            <EmptyTitle>
              {kind === "too-large"
                ? "This file is too large to preview"
                : kind === "submodule"
                  ? "Git submodule preview unavailable"
                : "Binary preview unavailable"}
            </EmptyTitle>
            <EmptyDescription>
              {kind === "submodule"
                ? `This path points to submodule commit ${item.objectId}.`
                : `${formatRepositorySize(item.size)} · Download the file to inspect its complete contents.`}
            </EmptyDescription>
          </EmptyHeader>
          {kind !== "submodule" ? (
            <EmptyContent>
              <Button
                nativeButton={false}
                render={<Link download={fileName} href={downloadHref} />}
              >
                <DownloadIcon data-icon="inline-start" />
                Download {fileName}
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      )}
    </div>
  );
}
