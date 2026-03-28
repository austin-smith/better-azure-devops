"use client";

import { useRef } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { THEME_META, THEMES, type Theme } from "@/lib/theme-config";

type ThemeSwitcherModalProps = {
  isOpen: boolean;
  onClose: () => void;
  selectedTheme: string | undefined;
  onSelectTheme: (theme: Theme) => void;
};

export function ThemeSwitcherModal({
  isOpen,
  onClose,
  selectedTheme,
  onSelectTheme,
}: ThemeSwitcherModalProps) {
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        initialFocus={() => selectedButtonRef.current}
        showCloseButton={false}
        className="max-w-sm gap-0 p-0"
      >
        <DialogHeader className="flex-row items-center justify-between px-4 py-4">
          <DialogTitle>Theme</DialogTitle>
          <DialogClose className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </DialogHeader>
        <Separator />
        <div className="flex flex-col gap-1 p-2">
          {THEMES.map((theme) => {
            const { icon: Icon, label } = THEME_META[theme];
            const isCurrent = theme === selectedTheme;

            return (
              <button
                key={theme}
                ref={isCurrent ? selectedButtonRef : null}
                type="button"
                onClick={() => onSelectTheme(theme)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left outline-none transition-colors",
                  "hover:bg-accent focus-visible:bg-accent focus-visible:ring-[2px] focus-visible:ring-inset focus-visible:ring-ring/50",
                  isCurrent ? "bg-accent ring-1 ring-border" : "bg-transparent",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md border",
                      isCurrent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{label}</span>
                </span>
                <span className="flex size-4 items-center justify-center text-muted-foreground">
                  {isCurrent ? <CheckIcon className="size-4 text-foreground" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
