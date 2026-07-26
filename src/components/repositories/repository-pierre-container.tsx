"use client";

import { DIFFS_TAG_NAME } from "@pierre/diffs";
import { forwardRef, useMemo } from "react";

export const RepositoryPierreContainer = forwardRef<
  HTMLDivElement,
  { prerenderedHTML: string }
>(function RepositoryPierreContainer({ prerenderedHTML }, ref) {
  const html = useMemo(
    () => ({
      __html: `<${DIFFS_TAG_NAME}><template shadowrootmode="open">${prerenderedHTML}</template></${DIFFS_TAG_NAME}>`,
    }),
    [prerenderedHTML],
  );

  return (
    <div
      className="repository-pierre"
      ref={ref}
      dangerouslySetInnerHTML={html}
      suppressHydrationWarning
    />
  );
});

export function getRepositoryPierreElement(
  container: HTMLDivElement | null,
) {
  return container?.querySelector<HTMLElement>(DIFFS_TAG_NAME) ?? null;
}
