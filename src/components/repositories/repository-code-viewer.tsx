"use client";

import type { PreloadedFileResult } from "@pierre/diffs/ssr";
import {
  File,
  type SelectedLineRange,
} from "@pierre/diffs";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  LinkIcon,
} from "lucide-react";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import { useTheme } from "@/components/themes/theme-provider";
import {
  getRepositoryPierreElement,
  RepositoryPierreContainer,
} from "@/components/repositories/repository-pierre-container";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getRepositoryFileLineHash,
  MAX_RENDERED_REPOSITORY_LINES,
  parseRepositoryFileLineHash,
} from "@/lib/repositories/pierre-file";

export function RepositoryCodeViewer({
  downloadHref,
  fileName,
  fullContent,
  isTruncated,
  lineCount,
  permalinkHref,
  preloadedFile,
  sourceKey,
}: {
  downloadHref: string;
  fileName: string;
  fullContent: string | null;
  isTruncated: boolean;
  lineCount: number;
  permalinkHref: string | null;
  preloadedFile: PreloadedFileResult<undefined>;
  sourceKey: string;
}) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<File<undefined> | null>(null);
  const sourceContent = fullContent ?? preloadedFile.file.contents;
  const allLines = useMemo(
    () => sourceContent.split(/\r?\n/),
    [sourceContent],
  );
  const renderedLineCount = Math.min(
    lineCount,
    MAX_RENDERED_REPOSITORY_LINES,
  );
  const [selection, setSelection] = useState<
    SelectedLineRange | null | undefined
  >(undefined);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const copyCodeLabel = selection
    ? "Copy selection"
    : isTruncated && fullContent === null
      ? "Copy preview"
      : "Copy file";

  useEffect(() => {
    const syncSelectionFromHash = () => {
      const parsedSelection = parseRepositoryFileLineHash(
        window.location.hash,
      );
      const hashSelection =
        parsedSelection && parsedSelection.end <= renderedLineCount
          ? parsedSelection
          : null;

      if (parsedSelection && !hashSelection) {
        const url = new URL(window.location.href);

        url.hash = "";
        window.history.replaceState(null, "", url);
      }

      setSelection(hashSelection);

      if (!hashSelection) {
        return;
      }

      window.requestAnimationFrame(() => {
        const fileElement = getRepositoryPierreElement(containerRef.current);
        const lineElement = fileElement?.shadowRoot?.querySelector(
          `[data-line="${hashSelection.start}"]`,
        );

        lineElement?.scrollIntoView({ block: "center" });
      });
    };

    syncSelectionFromHash();
    window.addEventListener("hashchange", syncSelectionFromHash);

    return () => {
      window.removeEventListener("hashchange", syncSelectionFromHash);
    };
  }, [renderedLineCount, sourceKey]);

  const handleLineSelected = useCallback(
    (nextSelection: SelectedLineRange | null) => {
      const url = new URL(window.location.href);

      if (nextSelection) {
        url.hash = getRepositoryFileLineHash(nextSelection);
      } else if (parseRepositoryFileLineHash(url.hash)) {
        url.hash = "";
      }

      window.history.replaceState(null, "", url);
      setSelection(nextSelection);
    },
    [],
  );
  const interactiveOptions = useMemo(
    () => ({
      ...preloadedFile.options,
      controlledSelection: true,
      enableLineSelection: true,
      onLineSelected: handleLineSelected,
    }),
    [handleLineSelected, preloadedFile.options],
  );

  useLayoutEffect(() => {
    const fileElement = getRepositoryPierreElement(containerRef.current);

    if (fileElement) {
      fileElement.style.colorScheme = resolvedTheme;
    }
  }, [resolvedTheme]);

  useLayoutEffect(() => {
    const fileElement = getRepositoryPierreElement(containerRef.current);

    if (!fileElement) {
      return;
    }

    const instance = new File<undefined>(
      interactiveOptions,
      undefined,
      true,
    );

    instanceRef.current = instance;
    instance.hydrate({
      file: preloadedFile.file,
      fileContainer: fileElement,
      prerenderedHTML: preloadedFile.prerenderedHTML,
    });

    return () => {
      instance.cleanUp();
      instanceRef.current = null;
    };
  }, [interactiveOptions, preloadedFile]);

  useLayoutEffect(() => {
    if (selection !== undefined) {
      instanceRef.current?.setSelectedLines(selection, {
        notify: false,
      });
    }
  }, [selection]);

  async function copySelectedCode() {
    const selectedLines = selection
      ? allLines.slice(
          Math.min(selection.start, selection.end) - 1,
          Math.max(selection.start, selection.end),
        )
      : allLines;

    await navigator.clipboard.writeText(selectedLines.join("\n"));
    setCopied("code");
    window.setTimeout(() => {
      setCopied(null);
    }, 1_500);
  }

  async function copyPermalink() {
    const url = new URL(
      permalinkHref ?? window.location.href,
      window.location.origin,
    );

    if (selection) {
      url.hash = getRepositoryFileLineHash(selection);
    }

    await navigator.clipboard.writeText(url.href);
    setCopied("link");
    window.setTimeout(() => {
      setCopied(null);
    }, 1_500);
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <RepositoryPathIcon kind="file" path={fileName} />
          <span className="truncate">{fileName}</span>
          <span className="font-mono text-xs font-normal text-muted-foreground">
            {lineCount} lines
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button onClick={copySelectedCode} size="sm" variant="ghost">
            {copied === "code" ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copyCodeLabel}
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={permalinkHref ? "Copy permalink" : "Copy link"}
                  onClick={copyPermalink}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              {copied === "link" ? <CheckIcon /> : <LinkIcon />}
            </TooltipTrigger>
            <TooltipContent>
              {permalinkHref ? "Copy permalink" : "Copy link"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label="Download file"
                  nativeButton={false}
                  render={<Link download={fileName} href={downloadHref} />}
                  size="icon-sm"
                  variant="ghost"
                />
              }
            >
              <DownloadIcon />
            </TooltipTrigger>
            <TooltipContent>Download file</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {isTruncated ? (
        <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Showing the first{" "}
          {MAX_RENDERED_REPOSITORY_LINES.toLocaleString()} lines. Download the
          file to view the rest.
        </div>
      ) : null}

      <div
        aria-label={`Source code for ${fileName}`}
        className="max-h-[72vh] overflow-auto bg-muted/10"
        role="region"
        tabIndex={0}
      >
        <RepositoryPierreContainer
          ref={containerRef}
          prerenderedHTML={preloadedFile.prerenderedHTML}
        />
      </div>
    </section>
  );
}
