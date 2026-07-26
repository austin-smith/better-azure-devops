"use client";

import * as React from "react";
import { ModifierKeyKbd } from "@/components/modifier-key-kbd";
import { ThemeFamilySwatches } from "@/components/themes/theme-family-swatches";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTheme } from "@/components/themes/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeFamily } from "@/hooks/use-theme-family";
import {
  THEME_FAMILY_OPTIONS,
  THEME_MODE_ICON_MAP,
  THEME_MODE_OPTIONS,
  normalizeThemeMode,
} from "@/lib/theme/constants";
import { computeThemeFamilySwatches } from "@/components/themes/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { themeFamily, setThemeFamily } = useThemeFamily();
  const selectedTheme = normalizeThemeMode(theme);
  const selectedThemeLabel =
    THEME_MODE_OPTIONS.find((option) => option.value === selectedTheme)?.label ??
      "System";
  const triggerLabel = `Theme: ${selectedThemeLabel}`;
  const ThemeIcon = THEME_MODE_ICON_MAP[selectedTheme];
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
    setThemeFamilyOptions(computeThemeFamilySwatches());
  }, [resolvedTheme, selectedTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={triggerLabel}
        title={triggerLabel}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
        )}
      >
        <ThemeIcon data-icon="inline-start" />
        <span className="sr-only">{triggerLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selectedTheme}>
            {THEME_MODE_OPTIONS.map((option) => {
              const Icon = THEME_MODE_ICON_MAP[option.value];

              return (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  onClick={() => setTheme(option.value)}
                >
                  <Icon />
                  <span>{option.label}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme Family</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={themeFamily}>
            {themeFamilyOptions.map((option) => {
              return (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  onClick={() => setThemeFamily(option.value)}
                >
                  <ThemeFamilySwatches
                    accentColor={option.accentColor}
                    className="mr-0.5"
                    primaryColor={option.primaryColor}
                    secondaryColor={option.secondaryColor}
                  />
                  <span>{option.label}</span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="px-1.5 py-1">
          <p className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground">
            <span>Theme Switcher</span>
            <KbdGroup className="ml-auto">
              <ModifierKeyKbd />
              <Kbd>J</Kbd>
            </KbdGroup>
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
