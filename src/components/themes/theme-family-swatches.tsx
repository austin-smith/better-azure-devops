"use client";

import { cn } from "@/lib/utils";

type ThemeFamilySwatchesProps = {
  accentColor: string;
  className?: string;
  primaryColor: string;
  secondaryColor: string;
};

export function ThemeFamilySwatches({
  accentColor,
  className,
  primaryColor,
  secondaryColor,
}: ThemeFamilySwatchesProps) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span
        className="size-2.5 rounded-full border border-border/50 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]"
        style={{ backgroundColor: primaryColor }}
      />
      <span
        className="size-2.5 rounded-full border border-border/50 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]"
        style={{ backgroundColor: secondaryColor }}
      />
      <span
        className="size-2.5 rounded-full border border-border/50 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08)]"
        style={{ backgroundColor: accentColor }}
      />
    </span>
  );
}
