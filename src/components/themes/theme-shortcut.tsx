"use client";

import { useCallback, useEffect, useState } from "react";
import { ThemeSwitcherModal } from "@/components/themes/theme-switcher-modal";
import { useTheme } from "@/components/themes/theme-provider";
import {
  getNextThemeMode,
  normalizeThemeMode,
} from "@/lib/theme/constants";

export function ThemeShortcut() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const cycleTheme = useCallback(() => {
    setTheme(getNextThemeMode(normalizeThemeMode(theme)));
  }, [theme, setTheme]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();

        if (isOpen) {
          cycleTheme();
          return;
        }

        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTheme, isOpen]);

  return (
    <ThemeSwitcherModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
    />
  );
}
