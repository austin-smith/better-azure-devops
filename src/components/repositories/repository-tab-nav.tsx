import Link from "next/link";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RepositoryTabItem = {
  active: boolean;
  count?: number | string | null;
  href: string;
  icon?: ComponentType<{ className?: string }>;
  label: string;
};

/**
 * The repository toolbar, pull request sections, and every in-page filter share
 * this underline tab treatment so navigation never reads as four different
 * controls on one screen.
 */
export function RepositoryTabNav({
  ariaLabel,
  className,
  items,
  size = "default",
}: {
  ariaLabel: string;
  className?: string;
  items: RepositoryTabItem[];
  size?: "default" | "sm";
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex min-w-0 items-center gap-1 overflow-x-auto",
        size === "sm" ? "h-8" : "h-10",
        className,
      )}
    >
      {items.map((item) => (
        <Link
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex h-full shrink-0 items-center gap-1.5 border-b-2 border-transparent text-muted-foreground transition-colors hover:text-foreground",
            size === "sm" ? "px-1.5 text-xs" : "px-2 text-sm",
            item.active && "border-foreground font-medium text-foreground",
          )}
          href={item.href}
          key={item.label}
        >
          {item.icon ? <item.icon className="size-4" /> : null}
          {item.label}
          {item.count ? (
            <Badge className="px-1.5" variant="secondary">
              {item.count}
            </Badge>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
