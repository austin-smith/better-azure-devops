"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const FILE_TREE_WIDTH_KEY = "pull-request-file-tree-width";
const DEFAULT_TREE_PERCENTAGE = 24;
const MIN_TREE_PERCENTAGE = 12;
const MAX_TREE_PERCENTAGE = 50;

type FilesLayout = { diffs: number; tree: number };

function normalizeLayout(layout: Record<string, number>): FilesLayout | null {
  const tree = layout.tree;
  const diffs = layout.diffs;

  if (
    typeof tree !== "number" ||
    typeof diffs !== "number" ||
    tree < MIN_TREE_PERCENTAGE ||
    tree > MAX_TREE_PERCENTAGE
  ) {
    return null;
  }

  return { diffs, tree };
}

function readStoredLayout(): FilesLayout | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(FILE_TREE_WIDTH_KEY);

    return stored ? normalizeLayout(JSON.parse(stored) as never) : null;
  } catch {
    return null;
  }
}

function writeStoredLayout(layout: Record<string, number>) {
  const normalized = normalizeLayout(layout);

  if (!normalized) {
    return;
  }

  try {
    window.localStorage.setItem(
      FILE_TREE_WIDTH_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // A width preference should never block reviewing a pull request.
  }
}

/**
 * The file tree is a navigation aid rather than part of the diff, so its width
 * is the reader's to set and it can be dismissed entirely. Paths run long, so a
 * fixed column either truncates them or steals room from the code.
 *
 * The panel group is mounted at every width and hiding unmounts it, rather than
 * rendering a separate narrow layout: the diffs are the heaviest content on the
 * page and must never be mounted twice.
 */
export function RepositoryPullRequestFilesLayout({
  children,
  toolbar,
  tree,
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  tree: ReactNode;
}) {
  const [isTreeVisible, setIsTreeVisible] = useState(true);
  // Read once on mount so the server and client agree on the first render.
  const [layout] = useState<FilesLayout>(
    () =>
      readStoredLayout() ?? {
        diffs: 100 - DEFAULT_TREE_PERCENTAGE,
        tree: DEFAULT_TREE_PERCENTAGE,
      },
  );

  const diffColumn = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-expanded={isTreeVisible}
                aria-label={isTreeVisible ? "Hide file tree" : "Show file tree"}
                onClick={() => {
                  setIsTreeVisible((visible) => !visible);
                }}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            {isTreeVisible ? <PanelLeftCloseIcon /> : <PanelLeftOpenIcon />}
          </TooltipTrigger>
          <TooltipContent side="right">
            {isTreeVisible ? "Hide file tree" : "Show file tree"}
          </TooltipContent>
        </Tooltip>
        {toolbar}
      </div>
      {children}
    </div>
  );

  if (!isTreeVisible) {
    return diffColumn;
  }

  return (
    /* The panels are left to stretch to the group's height so the drag handle
       spans the whole column rather than collapsing to a sliver at the top.
       The library also clips the group and scrolls each panel's content
       wrapper, and any overflow other than `visible` is a scrolling box, so
       both of those captured the tree's sticky positioning and pinned it to a
       container that never scrolls, leaving the tree to slide away with the
       page. Both are restored to `visible` so the viewport is the scrolling
       ancestor again. Nothing is left unclipped: the tree caps and scrolls its
       own height, and the diff panel keeps the wrapper scrolling that wide
       code relies on. */
    <ResizablePanelGroup
      defaultLayout={layout}
      onLayoutChanged={writeStoredLayout}
      orientation="horizontal"
      style={{ overflow: "visible" }}
    >
      <ResizablePanel
        className="min-w-0"
        defaultSize={`${layout.tree}%`}
        id="tree"
        maxSize={`${MAX_TREE_PERCENTAGE}%`}
        minSize={`${MIN_TREE_PERCENTAGE}%`}
        style={{ overflow: "visible" }}
      >
        {tree}
      </ResizablePanel>
      {/* No grip: the tree and the diff cards already draw their own borders,
          so a permanent handle would be a third vertical line in the same
          gutter. The divider stays invisible until hovered, which is how the
          editors this view resembles behave. A 1px line is an unusable target,
          so the grab area is widened well past it. The library exposes no
          drag-state attribute, so `active` carries the pressed state. */}
      <ResizableHandle
        aria-label="Resize the file tree"
        className="mx-1.5 cursor-col-resize bg-transparent transition-colors after:w-4 hover:bg-border active:bg-ring"
      />
      <ResizablePanel
        className="min-w-0"
        defaultSize={`${layout.diffs}%`}
        id="diffs"
      >
        {diffColumn}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
