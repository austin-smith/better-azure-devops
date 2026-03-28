"use client";

import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { getNextTheme } from "@/lib/theme-config";
import { ThemeSwitcherModal } from "@/components/theme-switcher-modal";

export function ThemeShortcut() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const cycleTheme = useCallback(() => {
    setTheme(getNextTheme(theme));
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
      selectedTheme={theme}
      onSelectTheme={setTheme}
    />
  );
}
