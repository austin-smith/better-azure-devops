import Link from "next/link";
import { FileSearch2Icon, SearchIcon } from "lucide-react";
import { RepositoryPager } from "@/components/repositories/repository-pager";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import type {
  AzureGitSearchResult,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";
import { getRepositoryBlobHref } from "@/lib/azure-devops/git/urls";

const SEARCH_PAGE_SIZE = 25;

function getSearchPageHref(
  projectId: string,
  repositoryId: string,
  query: string,
  version: GitVersionDescriptor,
  cursor?: string | null,
) {
  const searchParams = new URLSearchParams({
    q: query,
    version: version.value,
    versionType: version.type,
  });

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  return `/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}/search?${searchParams}`;
}

export function RepositorySearchResults({
  cursor,
  infoCode,
  nextCursor,
  projectId,
  query,
  requestedVersion,
  repositoryId,
  results,
  totalCount,
  version,
}: {
  cursor: string | null;
  infoCode: number | null;
  nextCursor: string | null;
  projectId: string;
  query: string;
  requestedVersion: GitVersionDescriptor;
  repositoryId: string;
  results: AzureGitSearchResult[];
  totalCount: number;
  version: GitVersionDescriptor;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <form className="flex items-center gap-2" method="get">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search repository code"
            defaultValue={query}
            name="q"
            placeholder="Search symbols, text, or expressions"
            required
          />
        </InputGroup>
        <input name="versionType" type="hidden" value={version.type} />
        <input name="version" type="hidden" value={version.value} />
        <Button type="submit">Search</Button>
      </form>

      {infoCode !== null && infoCode !== 0 ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Azure Code Search returned service state {infoCode}. Results can be
          incomplete while this repository or branch is indexing.
        </p>
      ) : null}

      {requestedVersion.type !== "branch" ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Azure Code Search supports branch indexes only. Results are from{" "}
          <span className="font-mono text-foreground">{version.value}</span>,
          not {requestedVersion.type}{" "}
          <span className="font-mono text-foreground">
            {requestedVersion.value}
          </span>
          .
        </p>
      ) : null}

      {results.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileSearch2Icon />
            </EmptyMedia>
            <EmptyTitle>
              {query ? "No indexed matches" : "Search this repository"}
            </EmptyTitle>
            <EmptyDescription>
              {query
                ? "Try a broader query or the repository’s default branch."
                : "Azure Code Search is permission-trimmed and branch-indexed. Results come from the selected branch."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {results.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {totalCount.toLocaleString()}
            </span>{" "}
            {totalCount === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
            on <span className="font-mono">{version.value}</span>
          </p>
          <ol className="divide-y">
            {results.map((result) => {
              const resultVersion: GitVersionDescriptor = result.changeId
                ? { type: "commit", value: result.changeId }
                : { type: "branch", value: result.branch || version.value };
              const matchLabel = result.matches.some(
                (match) => match.field === "fileName",
              )
                ? "file name match"
                : `${result.matches.length} ${
                    result.matches.length === 1 ? "match" : "matches"
                  }`;

              return (
                <li
                  className="flex min-w-0 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                  key={`${result.contentId}:${result.path}`}
                >
                  <RepositoryPathIcon kind="file" path={result.path} />
                  <Link
                    className="min-w-0 flex-1 truncate font-mono text-sm hover:underline"
                    href={getRepositoryBlobHref(
                      result.project.id,
                      result.repository.id,
                      result.path,
                      resultVersion,
                    )}
                  >
                    {result.path}
                  </Link>
                  {result.matches.length > 0 ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {matchLabel}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <RepositoryPager
        buildHref={(pageCursor) =>
          getSearchPageHref(
            projectId,
            repositoryId,
            query,
            version,
            pageCursor,
          )
        }
        cursor={cursor}
        label="Search result pages"
        nextCursor={nextCursor}
        pageSize={SEARCH_PAGE_SIZE}
      />
    </div>
  );
}
