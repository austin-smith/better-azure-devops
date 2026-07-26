import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Azure DevOps repository endpoints page with a numeric `$skip` offset that the
 * routes carry as an opaque `cursor` search param, so the previous page is
 * derived from the current offset instead of tracked in history.
 */
function getPreviousCursor(cursor: string | null, pageSize: number) {
  const offset = cursor ? Number(cursor) : 0;

  if (!Number.isSafeInteger(offset) || offset <= 0) {
    return null;
  }

  return { value: Math.max(0, offset - pageSize) || null };
}

export function RepositoryPager({
  buildHref,
  cursor,
  label,
  newerLabel = "Previous",
  nextCursor,
  olderLabel = "Next",
  pageSize,
}: {
  buildHref: (cursor: string | null) => string;
  cursor: string | null;
  label: string;
  newerLabel?: string;
  nextCursor: string | null;
  olderLabel?: string;
  pageSize: number;
}) {
  const previous = getPreviousCursor(cursor, pageSize);

  if (!previous && !nextCursor) {
    return null;
  }

  return (
    <nav
      aria-label={label}
      className="flex items-center justify-between gap-2"
    >
      <Button
        disabled={!previous}
        nativeButton={!previous}
        render={
          previous ? (
            <Link href={buildHref(previous.value ? String(previous.value) : null)} />
          ) : undefined
        }
        size="sm"
        variant="outline"
      >
        <ChevronLeftIcon data-icon="inline-start" />
        {newerLabel}
      </Button>
      <Button
        disabled={!nextCursor}
        nativeButton={!nextCursor}
        render={nextCursor ? <Link href={buildHref(nextCursor)} /> : undefined}
        size="sm"
        variant="outline"
      >
        {olderLabel}
        <ChevronRightIcon data-icon="inline-end" />
      </Button>
    </nav>
  );
}
