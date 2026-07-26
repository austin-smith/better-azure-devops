"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArchiveIcon,
  FolderGit2Icon,
  GitBranchIcon,
  GitForkIcon,
  Grid2X2Icon,
  ListIcon,
  SearchIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { ProjectImage } from "@/components/project-image";
import { NoRepositoryMatchesState } from "@/components/repositories/repository-state";
import { Badge } from "@/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  getRepositoryHref,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";
import type { RepositoryListEntry } from "@/lib/repositories/loaders";
import { formatRepositorySize } from "@/lib/repositories/format";

type ViewMode = "grid" | "list";

function getDefaultBranchLabel(repository: RepositoryListEntry) {
  return repository.defaultBranch
    ? stripRefPrefix(repository.defaultBranch)
    : "No default branch";
}

function RepositoryStatusBadges({
  repository,
}: {
  repository: RepositoryListEntry;
}) {
  return (
    <>
      {repository.isFork ? (
        <Badge variant="secondary">
          <GitForkIcon data-icon="inline-start" />
          Fork
        </Badge>
      ) : null}
      {repository.isDisabled ? (
        <Badge variant="destructive">
          <ArchiveIcon data-icon="inline-start" />
          Disabled
        </Badge>
      ) : null}
      {repository.isInMaintenance ? (
        <Badge variant="outline">
          <ShieldAlertIcon data-icon="inline-start" />
          Maintenance
        </Badge>
      ) : null}
    </>
  );
}

function RepositoryGridCard({
  repository,
}: {
  repository: RepositoryListEntry;
}) {
  return (
    <li className="relative flex flex-col gap-2 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="flex min-w-0 items-center gap-2">
        <FolderGit2Icon className="size-4 shrink-0 text-muted-foreground" />
        <Link
          className="truncate text-sm font-medium after:absolute after:inset-0 after:content-['']"
          href={getRepositoryHref(repository.project.id, repository.id)}
        >
          {repository.name}
        </Link>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <ProjectImage
          className="size-4"
          imageUrl={repository.projectImageUrl}
          name={repository.project.name}
          size="sm"
        />
        <span className="truncate">{repository.project.name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <span className="truncate font-mono">
            {getDefaultBranchLabel(repository)}
          </span>
        </span>
        <span>{formatRepositorySize(repository.size)}</span>
        <RepositoryStatusBadges repository={repository} />
      </div>
    </li>
  );
}

function RepositoryListRow({
  repository,
}: {
  repository: RepositoryListEntry;
}) {
  return (
    <li className="relative flex min-w-0 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50">
      <FolderGit2Icon className="size-4 shrink-0 text-muted-foreground" />
      <Link
        className="shrink-0 text-sm font-medium after:absolute after:inset-0 after:content-['']"
        href={getRepositoryHref(repository.project.id, repository.id)}
      >
        {repository.name}
      </Link>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
        <ProjectImage
          className="size-4"
          imageUrl={repository.projectImageUrl}
          name={repository.project.name}
          size="sm"
        />
        <span className="truncate">{repository.project.name}</span>
      </span>
      <RepositoryStatusBadges repository={repository} />
      <span className="hidden min-w-0 items-center gap-1 text-xs text-muted-foreground md:flex">
        <GitBranchIcon className="size-3.5 shrink-0" />
        <span className="truncate font-mono">
          {getDefaultBranchLabel(repository)}
        </span>
      </span>
      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
        {formatRepositorySize(repository.size)}
      </span>
    </li>
  );
}

export function RepositoryList({
  repositories,
}: {
  repositories: RepositoryListEntry[];
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRepositories = useMemo(
    () =>
      repositories.filter((repository) => {
        if (!normalizedQuery) {
          return true;
        }

        return `${repository.project.name} ${repository.name}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, repositories],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <InputGroup className="max-w-80">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search repositories"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search repositories or projects"
            value={query}
          />
        </InputGroup>
        <span className="text-xs text-muted-foreground">
          {filteredRepositories.length}{" "}
          {filteredRepositories.length === 1 ? "repository" : "repositories"}
        </span>
        <ToggleGroup
          aria-label="Repository display"
          className="ml-auto"
          value={[view]}
          onValueChange={(values) => {
            const nextView = values[0];

            if (nextView === "grid" || nextView === "list") {
              setView(nextView);
            }
          }}
        >
          <ToggleGroupItem aria-label="List view" value="list">
            <ListIcon />
          </ToggleGroupItem>
          <ToggleGroupItem aria-label="Grid view" value="grid">
            <Grid2X2Icon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {filteredRepositories.length === 0 ? (
        <NoRepositoryMatchesState
          onClear={() => {
            setQuery("");
          }}
        />
      ) : (
        <ul
          className={cn(
            view === "grid"
              ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
              : "divide-y overflow-hidden rounded-lg border bg-card",
          )}
        >
          {filteredRepositories.map((repository) =>
            view === "grid" ? (
              <RepositoryGridCard
                key={`${repository.project.id}:${repository.id}`}
                repository={repository}
              />
            ) : (
              <RepositoryListRow
                key={`${repository.project.id}:${repository.id}`}
                repository={repository}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}
