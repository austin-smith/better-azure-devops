"use client";

import type { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr";
import {
  FileDiff,
  parseDiffFromFile,
  type DiffLineAnnotation,
  type FileDiffOptions,
  type SelectedLineRange,
} from "@pierre/diffs";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  getRepositoryPierreElement,
  RepositoryPierreContainer,
} from "@/components/repositories/repository-pierre-container";
import { RepositoryPullRequestCommentForm } from "@/components/repositories/repository-pull-request-comment-form";
import { useTheme } from "@/components/themes/theme-provider";
import {
  getRepositoryDiffLineHash,
  parseRepositoryDiffLineHash,
} from "@/lib/repositories/pierre-diff";
import type { PullRequestActionState } from "@/lib/repositories/pull-request-action-state";

/**
 * Marker metadata for the transient annotation that hosts the inline comment
 * composer under the selected lines. Compared by reference, so it can never
 * collide with caller-provided annotation metadata.
 */
const DRAFT_COMPOSER_METADATA = { kind: "draft-composer" } as const;
type DraftComposerMetadata = typeof DRAFT_COMPOSER_METADATA;
const DRAFT_COMPOSER_KEY = "__draft-composer__";

type PortalEntry<LAnnotation> = {
  annotation: DiffLineAnnotation<LAnnotation | DraftComposerMetadata>;
  element: HTMLElement;
};

/** Mirrors pierre's slot naming for diff line annotations. */
function getAnnotationSlotName(annotation: {
  lineNumber: number;
  side: "additions" | "deletions";
}) {
  return `annotation-${annotation.side}-${annotation.lineNumber}`;
}

type RepositoryMultiFileDiffProps<LAnnotation> = Pick<
  PreloadMultiFileDiffResult<LAnnotation>,
  "newFile" | "oldFile" | "options" | "prerenderedHTML"
> & {
  /**
   * Line-anchored annotations to render inside the diff, typically review
   * threads. Requires `getAnnotationKey` and `renderAnnotation`.
   */
  annotations?: DiffLineAnnotation<LAnnotation>[];
  ariaLabel: string;
  commentAction?: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  /** Stable identity for an annotation, used to key its rendered portal. */
  getAnnotationKey?: (annotation: DiffLineAnnotation<LAnnotation>) => string;
  /**
   * Reports annotations whose target line is not part of the rendered diff
   * (for example a thread on an unexpanded context line), so the caller can
   * surface them somewhere visible instead of silently dropping them. Keys
   * are sorted and the callback only fires when the set changes.
   */
  onUnanchoredAnnotationsChange?: (keys: readonly string[]) => void;
  renderAnnotation?: (
    annotation: DiffLineAnnotation<LAnnotation>,
  ) => ReactNode;
  syncSelectionHash?: boolean;
};

export function RepositoryMultiFileDiff<LAnnotation = undefined>({
  annotations,
  ariaLabel,
  commentAction,
  getAnnotationKey,
  newFile,
  oldFile,
  onUnanchoredAnnotationsChange,
  options,
  prerenderedHTML,
  renderAnnotation,
  syncSelectionHash = true,
}: RepositoryMultiFileDiffProps<LAnnotation>) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<FileDiff<
    LAnnotation | DraftComposerMetadata
  > | null>(null);
  const shouldScrollToSelectionRef = useRef(false);
  const [selectedLines, setSelectedLines] = useState<
    SelectedLineRange | null | undefined
  >(() => (syncSelectionHash ? undefined : null));
  const portalsRef = useRef(new Map<string, PortalEntry<LAnnotation>>());
  const appliedAnnotationsRef = useRef<unknown>(null);
  const reportedUnanchoredRef = useRef<readonly string[] | null>(null);
  const [portalEntries, setPortalEntries] = useState<
    ReadonlyMap<string, PortalEntry<LAnnotation>>
  >(() => new Map());
  const getAnnotationKeyRef = useRef(getAnnotationKey);
  const onUnanchoredRef = useRef(onUnanchoredAnnotationsChange);

  // Layout effect so the refs are fresh before the hydrate effect below runs
  // in the same commit.
  useLayoutEffect(() => {
    getAnnotationKeyRef.current = getAnnotationKey;
    onUnanchoredRef.current = onUnanchoredAnnotationsChange;
  }, [getAnnotationKey, onUnanchoredAnnotationsChange]);

  useEffect(() => {
    if (!syncSelectionHash) {
      return;
    }

    const syncSelectionFromHash = () => {
      const hashSelection = parseRepositoryDiffLineHash(
        window.location.hash,
      );

      shouldScrollToSelectionRef.current = hashSelection !== null;
      setSelectedLines(hashSelection);
    };

    syncSelectionFromHash();
    window.addEventListener("hashchange", syncSelectionFromHash);

    return () => {
      window.removeEventListener("hashchange", syncSelectionFromHash);
    };
  }, [newFile, oldFile, syncSelectionHash]);

  const handleLineSelected = useCallback(
    (selection: SelectedLineRange | null) => {
      if (syncSelectionHash) {
        const url = new URL(window.location.href);

        if (selection) {
          url.hash = getRepositoryDiffLineHash(selection);
        } else if (parseRepositoryDiffLineHash(url.hash)) {
          url.hash = "";
        }

        window.history.replaceState(null, "", url);
      }
      setSelectedLines(selection);
    },
    [syncSelectionHash],
  );
  const clearSelection = useCallback(() => {
    handleLineSelected(null);
  }, [handleLineSelected]);

  const selectionSide = selectedLines?.side ?? selectedLines?.endSide;
  const hasCommentableSelection = Boolean(
    selectedLines &&
      selectionSide &&
      (!selectedLines.side ||
        !selectedLines.endSide ||
        selectedLines.side === selectedLines.endSide),
  );
  const draftAnnotation = useMemo(():
    | DiffLineAnnotation<DraftComposerMetadata>
    | null => {
    if (!commentAction || !hasCommentableSelection || !selectedLines) {
      return null;
    }

    return {
      lineNumber: Math.max(selectedLines.start, selectedLines.end),
      metadata: DRAFT_COMPOSER_METADATA,
      side: selectionSide === "deletions" ? "deletions" : "additions",
    };
  }, [commentAction, hasCommentableSelection, selectedLines, selectionSide]);
  const lineAnnotations = useMemo(
    () => [
      ...((annotations ?? []) as DiffLineAnnotation<
        LAnnotation | DraftComposerMetadata
      >[]),
      ...(draftAnnotation ? [draftAnnotation] : []),
    ],
    [annotations, draftAnnotation],
  );
  const lineAnnotationsRef = useRef<
    DiffLineAnnotation<LAnnotation | DraftComposerMetadata>[]
  >([]);

  // Layout effect so the annotation-sync and hydrate effects below read the
  // current annotations without re-hydrating when only the set changes.
  useLayoutEffect(() => {
    lineAnnotationsRef.current = lineAnnotations;
  }, [lineAnnotations]);

  /**
   * The pierre instance runs in container-managed mode: React owns the
   * light DOM, so the instance never touches it — which also means it never
   * renders annotation elements itself. This reconciles our own slotted
   * wrapper divs (pierre's `annotation-{side}-{line}` slot convention)
   * against the current annotation set; the shadow root projects each
   * wrapper at its line and React portals the annotation UI into it.
   */
  const syncAnnotationElements = useCallback(() => {
    const host = getRepositoryPierreElement(containerRef.current);

    if (!host) {
      return;
    }

    const portals = portalsRef.current;
    const desired = new Map<
      string,
      DiffLineAnnotation<LAnnotation | DraftComposerMetadata>
    >();
    let changed = false;

    for (const annotation of lineAnnotationsRef.current) {
      const key =
        annotation.metadata === DRAFT_COMPOSER_METADATA
          ? DRAFT_COMPOSER_KEY
          : getAnnotationKeyRef.current?.(
              annotation as DiffLineAnnotation<LAnnotation>,
            );

      if (key != null) {
        desired.set(key, annotation);
      }
    }

    for (const [key, entry] of portals) {
      const annotation = desired.get(key);

      if (!annotation) {
        entry.element.remove();
        portals.delete(key);
        changed = true;
        continue;
      }

      if (annotation !== entry.annotation) {
        entry.element.slot = getAnnotationSlotName(annotation);
        portals.set(key, { annotation, element: entry.element });
        changed = true;
      }

      // The container's inner HTML is replaced when new server props arrive;
      // surviving wrappers must be re-attached to the fresh host.
      if (!entry.element.isConnected) {
        host.appendChild(entry.element);
      }
    }

    for (const [key, annotation] of desired) {
      if (portals.has(key)) {
        continue;
      }

      const element = document.createElement("div");

      element.slot = getAnnotationSlotName(annotation);
      element.className = "block font-sans whitespace-normal";
      host.appendChild(element);
      portals.set(key, { annotation, element });
      changed = true;
    }

    if (changed) {
      setPortalEntries(new Map(portals));
    }

    const reportUnanchored = onUnanchoredRef.current;

    if (!reportUnanchored) {
      return;
    }

    const unanchored = [...portals.entries()]
      .filter(
        ([key, entry]) =>
          key !== DRAFT_COMPOSER_KEY && entry.element.assignedSlot == null,
      )
      .map(([key]) => key)
      .sort();
    const previous = reportedUnanchoredRef.current;

    if (
      previous == null ||
      previous.length !== unanchored.length ||
      unanchored.some((key, index) => key !== previous[index])
    ) {
      reportedUnanchoredRef.current = unanchored;
      reportUnanchored(unanchored);
    }
  }, []);

  const interactiveOptions = useMemo(
    () =>
      ({
        ...options,
        controlledSelection: true,
        enableLineSelection: true,
        onLineSelected: handleLineSelected,
        // The server-provided options are typed for LAnnotation only; the
        // draft-composer metadata is additive and opaque to them.
      }) as FileDiffOptions<LAnnotation | DraftComposerMetadata>,
    [handleLineSelected, options],
  );
  const fileDiff = useMemo(
    () => parseDiffFromFile(oldFile, newFile, options?.parseDiffOptions),
    [newFile, oldFile, options?.parseDiffOptions],
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

    const instance = new FileDiff<LAnnotation | DraftComposerMetadata>(
      interactiveOptions,
      undefined,
      true,
    );

    instanceRef.current = instance;
    appliedAnnotationsRef.current = lineAnnotationsRef.current;
    instance.hydrate({
      fileContainer: fileElement,
      fileDiff,
      lineAnnotations: lineAnnotationsRef.current,
      newFile,
      oldFile,
      prerenderedHTML,
    });
    syncAnnotationElements();

    return () => {
      instance.cleanUp();
      instanceRef.current = null;
    };
  }, [
    fileDiff,
    interactiveOptions,
    newFile,
    oldFile,
    prerenderedHTML,
    syncAnnotationElements,
  ]);

  // Annotation changes (adding or removing the draft composer) re-render the
  // existing instance instead of tearing it down and re-hydrating.
  useLayoutEffect(() => {
    const instance = instanceRef.current;

    if (!instance || appliedAnnotationsRef.current === lineAnnotations) {
      return;
    }

    appliedAnnotationsRef.current = lineAnnotations;
    instance.setLineAnnotations(lineAnnotations);
    instance.rerender();
    syncAnnotationElements();
  }, [lineAnnotations, syncAnnotationElements]);

  useLayoutEffect(() => {
    if (selectedLines !== undefined) {
      instanceRef.current?.setSelectedLines(selectedLines, {
        notify: false,
      });

      if (selectedLines && shouldScrollToSelectionRef.current) {
        shouldScrollToSelectionRef.current = false;
        window.requestAnimationFrame(() => {
          getRepositoryPierreElement(
            containerRef.current,
          )?.shadowRoot?.querySelector("[data-selected-line]")?.scrollIntoView({
            block: "center",
          });
        });
      }
    }
  }, [selectedLines]);

  const portalNodes = [...portalEntries.entries()].map(([key, entry]) => {
    if (key === DRAFT_COMPOSER_KEY) {
      if (
        !commentAction ||
        !hasCommentableSelection ||
        !selectedLines ||
        !selectionSide
      ) {
        return null;
      }

      const firstLine = Math.min(selectedLines.start, selectedLines.end);
      const lastLine = Math.max(selectedLines.start, selectedLines.end);

      return createPortal(
        <div className="border-y bg-card px-3 py-2.5">
          <RepositoryPullRequestCommentForm
            action={commentAction}
            autoFocus
            hiddenFields={{
              end: selectedLines.end,
              side: selectionSide,
              start: selectedLines.start,
            }}
            onCancel={clearSelection}
            onSuccess={clearSelection}
            placeholder={`Comment on ${
              selectionSide === "additions" ? "new" : "original"
            } ${firstLine === lastLine ? `line ${firstLine}` : `lines ${firstLine}–${lastLine}`}…`}
            submitLabel="Add comment"
          />
        </div>,
        entry.element,
        key,
      );
    }

    if (!renderAnnotation) {
      return null;
    }

    return createPortal(
      renderAnnotation(entry.annotation as DiffLineAnnotation<LAnnotation>),
      entry.element,
      key,
    );
  });

  return (
    <div>
      <div
        aria-label={ariaLabel}
        className="max-h-[72vh] min-w-0 overflow-auto bg-muted/10"
        role="region"
        tabIndex={0}
      >
        <RepositoryPierreContainer
          ref={containerRef}
          prerenderedHTML={prerenderedHTML}
        />
      </div>
      {portalNodes}
      {commentAction && selectedLines && !hasCommentableSelection ? (
        <div className="border-t bg-muted/10 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Select lines on a single side of the diff to add an inline
            comment.
          </p>
        </div>
      ) : null}
    </div>
  );
}
