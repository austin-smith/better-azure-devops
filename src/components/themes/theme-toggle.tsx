"use client";

import * as React from "react";
import { ThemeFamilySwatches } from "@/components/themes/theme-family-swatches";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Kbd, KbdGroup, ModKbd } from "@/components/ui/kbd";
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
  const { theme, setTheme } = useTheme();
  const { themeFamily, setThemeFamily } = useThemeFamily();
  const selectedTheme = normalizeThemeMode(theme);
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
  }, [selectedTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle theme"
        title="Toggle theme"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
        )}
      >
        <ThemeIcon className="size-4" />
        <span className="sr-only">Toggle theme</span>
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
              <ModKbd />
              <Kbd>J</Kbd>
            </KbdGroup>
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
