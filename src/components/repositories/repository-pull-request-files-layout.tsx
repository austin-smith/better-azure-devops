"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The file tree is a navigation aid, not part of the diff, so it has to be
 * dismissible. It stays mounted and the grid column animates to zero instead of
 * unmounting, which keeps the transition to plain CSS and preserves the tree's
 * expanded folders and filter across a hide.
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

  return (
    <div
      className={cn(
        "grid items-start transition-[grid-template-columns,gap] duration-200 ease-out",
        isTreeVisible
          ? "gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]"
          : "gap-0 lg:grid-cols-[0rem_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "hidden min-w-0 transition-opacity duration-200 ease-out lg:block",
          isTreeVisible
            ? "opacity-100"
            : "pointer-events-none overflow-hidden opacity-0",
        )}
        inert={!isTreeVisible}
      >
        {tree}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-expanded={isTreeVisible}
                  aria-label={
                    isTreeVisible ? "Hide file tree" : "Show file tree"
                  }
                  className="hidden lg:inline-flex"
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
    </div>
  );
}
