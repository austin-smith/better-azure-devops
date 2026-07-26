"use client";

import { useMemo, useState } from "react";
import {
  ChevronRightIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  MessageSquareIcon,
  SearchIcon,
} from "lucide-react";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getChangeTypePresentation,
  getCheckToneTextClassName,
} from "@/lib/repositories/pull-request-presentation";
import {
  buildPullRequestFileTree,
  getPullRequestFileTreeDirectoryPaths,
  type PullRequestFileTreeEntry,
  type PullRequestFileTreeNode,
} from "@/lib/repositories/pull-request-file-tree";
import { cn } from "@/lib/utils";

/**
 * Additions and deletions reuse the shared positive and negative tones rather
 * than restating those colours, so a diff stat can never drift from the rest of
 * the pull request views.
 */
function DiffCounts({
  additions,
  deletions,
}: {
  additions: number | null;
  deletions: number | null;
}) {
  // Counts come from the diff, which is only loaded for the current page.
  if (additions === null || deletions === null) {
    return null;
  }

  return (
    <span className="shrink-0 font-mono text-xs">
      <span className={getCheckToneTextClassName("positive")}>
        +{additions}
      </span>{" "}
      <span className={getCheckToneTextClassName("negative")}>
        −{deletions}
      </span>
    </span>
  );
}

function TreeNodes({
  collapsed,
  depth,
  nodes,
  onToggle,
}: {
  collapsed: ReadonlySet<string>;
  depth: number;
  nodes: PullRequestFileTreeNode[];
  onToggle: (path: string) => void;
}) {
  return (
    <ul>
      {nodes.map((node) => {
        const indent = { paddingLeft: `${depth * 0.75 + 0.5}rem` };

        if (node.kind === "directory") {
          const isCollapsed = collapsed.has(node.path);

          return (
            <li key={node.path}>
              <button
                aria-expanded={!isCollapsed}
                className="flex w-full min-w-0 items-center gap-1.5 py-1 pr-2 text-left transition-colors hover:bg-muted/50"
                onClick={() => {
                  onToggle(node.path);
                }}
                style={indent}
                type="button"
              >
                <ChevronRightIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    !isCollapsed && "rotate-90",
                  )}
                />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {node.name}
                </span>
              </button>
              {isCollapsed ? null : (
                <TreeNodes
                  collapsed={collapsed}
                  depth={depth + 1}
                  nodes={node.children}
                  onToggle={onToggle}
                />
              )}
            </li>
          );
        }

        const changeType = getChangeTypePresentation(node.entry.changeType);

        return (
          <li key={node.path}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <a
                    className="flex min-w-0 items-center gap-1.5 py-1 pr-2 transition-colors hover:bg-muted/50"
                    href={node.entry.href ?? `#${node.entry.anchorId}`}
                    style={indent}
                  />
                }
              >
                <RepositoryPathIcon
                  className="size-3.5"
                  kind="file"
                  path={node.name}
                />
                {/* Status is carried by the file name colour (the VS Code
                    convention) so the row never stacks a third coloured
                    fragment beside the diff counts. */}
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-mono text-xs",
                    changeType.className,
                    changeType.letter === "D" && "line-through",
                  )}
                >
                  {node.name}
                </span>
                <span className="sr-only">{changeType.label}</span>
                {node.entry.threadCount > 0 ? (
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                    <MessageSquareIcon className="size-3" />
                    {node.entry.threadCount}
                  </span>
                ) : null}
                <DiffCounts
                  additions={node.entry.additions}
                  deletions={node.entry.deletions}
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                <span className="font-mono">{node.entry.path}</span> ·{" "}
                {changeType.label}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

export function RepositoryPullRequestFileTree({
  entries,
  totals,
}: {
  entries: PullRequestFileTreeEntry[];
  totals: { additions: number | null; deletions: number | null };
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(
    () =>
      normalizedQuery
        ? entries.filter((entry) =>
            entry.path.toLowerCase().includes(normalizedQuery),
          )
        : entries,
    [entries, normalizedQuery],
  );
  const tree = useMemo(
    () => buildPullRequestFileTree(filteredEntries),
    [filteredEntries],
  );
  // Filtering is only useful if the matches are visible, so a search always
  // expands the tree it produces.
  const effectiveCollapsed = normalizedQuery ? new Set<string>() : collapsed;

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);

      if (!next.delete(path)) {
        next.add(path);
      }

      return next;
    });
  }

  const directoryPaths = useMemo(
    () => getPullRequestFileTreeDirectoryPaths(tree),
    [tree],
  );
  const allCollapsed =
    directoryPaths.length > 0 &&
    directoryPaths.every((path) => effectiveCollapsed.has(path));

  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(directoryPaths));
  }

  return (
    <div className="sticky top-3 flex max-h-[calc(100svh-8rem)] flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {entries.length} {entries.length === 1 ? "file" : "files"}
        </span>
        <DiffCounts
          additions={totals.additions}
          deletions={totals.deletions}
        />
      </div>

      <div className="flex items-center gap-1 border-b p-2">
        <InputGroup className="h-7">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter changed files"
            className="text-xs"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Filter files"
            value={query}
          />
        </InputGroup>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={
                  allCollapsed ? "Expand all folders" : "Collapse all folders"
                }
                className="shrink-0"
                disabled={directoryPaths.length === 0}
                onClick={toggleAll}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            {allCollapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
          </TooltipTrigger>
          <TooltipContent>
            {allCollapsed ? "Expand all folders" : "Collapse all folders"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {filteredEntries.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No files match “{query}”.
          </p>
        ) : (
          <TreeNodes
            collapsed={effectiveCollapsed}
            depth={0}
            nodes={tree}
            onToggle={toggle}
          />
        )}
      </div>
    </div>
  );
}
