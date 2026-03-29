"use client";

import * as React from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { ThemeFamilySwatches } from "@/components/themes/theme-family-swatches";
import { useTheme } from "@/components/themes/theme-provider";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup, ModKbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  computeThemeFamilySwatches,
} from "@/components/themes/theme-provider";
import { useThemeFamily } from "@/hooks/use-theme-family";
import {
  THEME_FAMILY_OPTIONS,
  THEME_MODE_ICON_MAP,
  THEME_MODE_OPTIONS,
  normalizeThemeMode,
} from "@/lib/theme/constants";
import { cn } from "@/lib/utils";

type ThemeSwitcherModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ThemeSwitcherModal({
  isOpen,
  onClose,
}: ThemeSwitcherModalProps) {
  const { theme, setTheme } = useTheme();
  const { themeFamily, setThemeFamily } = useThemeFamily();
  const selectedButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const selectedTheme = normalizeThemeMode(theme);
  const [themeFamilyOptions, setThemeFamilyOptions] = React.useState(
    () =>
      THEME_FAMILY_OPTIONS.map((option) => ({
        ...option,
        primaryColor: "currentColor",
        secondaryColor: "currentColor",
        accentColor: "currentColor",
      })),
  );

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setThemeFamilyOptions(computeThemeFamilySwatches());
  }, [isOpen, selectedTheme]);

  const selectedThemeFamilyOption =
    themeFamilyOptions.find((option) => option.value === themeFamily) ??
    themeFamilyOptions[0];

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
        <div className="flex flex-col gap-3 p-2">
          <div className="space-y-1">
            <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Theme Mode
            </p>
            {THEME_MODE_OPTIONS.map((option) => {
              const Icon = THEME_MODE_ICON_MAP[option.value];
              const isCurrent = option.value === selectedTheme;

              return (
                <button
                  key={option.value}
                  ref={isCurrent ? selectedButtonRef : null}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-2 text-left outline-none transition-colors",
                    "hover:bg-accent focus-visible:bg-accent focus-visible:ring-[2px] focus-visible:ring-inset focus-visible:ring-ring/50",
                    isCurrent ? "bg-accent text-accent-foreground" : "bg-transparent",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center text-muted-foreground",
                        isCurrent && "text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-sm font-medium">{option.label}</span>
                  </span>
                  <span className="flex size-4 items-center justify-center text-muted-foreground">
                    {isCurrent ? (
                      <CheckIcon className="size-4 text-foreground" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2">
            <p className="px-2 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Theme Family
            </p>
            {selectedThemeFamilyOption ? (
              <Select
                value={themeFamily}
                onValueChange={(value) => setThemeFamily(value as typeof themeFamily)}
              >
                <SelectTrigger className="w-full rounded-md px-3">
                  <SelectValue className="items-center">
                    <span className="flex items-center gap-3 text-sm leading-none">
                      <ThemeFamilySwatches
                        accentColor={selectedThemeFamilyOption.accentColor}
                        primaryColor={selectedThemeFamilyOption.primaryColor}
                        secondaryColor={selectedThemeFamilyOption.secondaryColor}
                      />
                      <span>{selectedThemeFamilyOption.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="min-w-56">
                  <SelectGroup>
                    {themeFamilyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <ThemeFamilySwatches
                          accentColor={option.accentColor}
                          primaryColor={option.primaryColor}
                          secondaryColor={option.secondaryColor}
                        />
                        <span>{option.label}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            <span className="flex items-center justify-between gap-3">
              <span>Cycle modes</span>
              <KbdGroup>
                <ModKbd />
                <Kbd>J</Kbd>
              </KbdGroup>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
