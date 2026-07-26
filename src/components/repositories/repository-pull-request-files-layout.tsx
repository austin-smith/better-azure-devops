"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useGroupRef } from "react-resizable-panels";
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
import {
  DEFAULT_LAYOUT,
  MAX_TREE_PERCENTAGE,
  MIN_TREE_PERCENTAGE,
  readStoredLayout,
  writeStoredLayout,
} from "@/lib/repositories/pull-request-files-layout";

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
  const groupRef = useGroupRef();

  /**
   * The stored width is deliberately not read while rendering. This component
   * is server rendered, where there is no `localStorage`, so reading it during
   * the first client render would hydrate a returning reader's saved width
   * against server markup built from the default and mismatch every time. The
   * default renders on both sides and the saved width is applied immediately
   * afterwards, which costs one frame and cannot disagree.
   *
   * Hiding the tree unmounts the group, so this reapplies on every reveal
   * rather than only on mount.
   */
  useEffect(() => {
    if (!isTreeVisible) {
      return;
    }

    const stored = readStoredLayout();

    if (stored) {
      groupRef.current?.setLayout(stored);
    }
  }, [groupRef, isTreeVisible]);

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
    /* The panels stretch to the group's height so the drag handle spans the
       whole column rather than collapsing to a sliver at the top.

       The group and each panel's content wrapper are given `overflow` by the
       library, and any value other than `visible` is a scrolling box, so both
       captured the tree's sticky positioning and pinned it to a container that
       never scrolls. Both are restored to `visible` so the viewport is the
       scrolling ancestor and the page keeps its single, ordinary scroll.

       The library documents `overflow` on the group as a property that cannot
       be overridden; it can be today, and the alternative it steers toward —
       a fixed-height group whose panels scroll internally — puts a second
       scrollbar inside the page and was materially worse to use. The override
       is asserted in `tests/components/repositories` so a release that starts
       enforcing this fails loudly rather than unpinning the tree in silence. */
    <ResizablePanelGroup
      defaultLayout={DEFAULT_LAYOUT}
      groupRef={groupRef}
      onLayoutChanged={writeStoredLayout}
      orientation="horizontal"
      // Matched to the separator's own width so the grab region is not widened
      // past the element drawing it. The touch figure keeps the default's
      // headroom over the pointer one.
      resizeTargetMinimumSize={{ coarse: 24, fine: 16 }}
      style={{ overflow: "visible" }}
    >
      <ResizablePanel
        className="min-w-0"
        defaultSize={`${DEFAULT_LAYOUT.tree}%`}
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
          editors this view resembles behave. The library exposes no drag-state
          attribute, so `active` carries the pressed state.

          The separator is widened to the whole gutter and the visible line is
          drawn inside it, rather than the line being the element and the gutter
          being margins. The group grabs anywhere within
          `resizeTargetMinimumSize` of the separator, expanding its box when it
          is narrower, so a hairline element leaves the pointer able to drag in
          places that `:hover` never matches: the line would appear only across
          the middle of a gutter that is grabbable end to end. Element and grab
          region are the same box here, so both agree. */}
      <ResizableHandle
        aria-label="Resize the file tree"
        className="w-4 bg-transparent after:w-px after:bg-transparent after:transition-colors hover:after:bg-border active:after:bg-ring"
      />
      <ResizablePanel
        className="min-w-0"
        defaultSize={`${DEFAULT_LAYOUT.diffs}%`}
        id="diffs"
      >
        {diffColumn}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
