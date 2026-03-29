"use client";

import * as React from "react";
import {
  getThemeFamilyFromClassList,
  persistThemeFamilyPreference,
  THEME_FAMILY_CHANGE_EVENT,
} from "@/components/themes/theme-provider";
import {
  PREFERRED_THEME_FAMILY_KEY,
  type ThemeFamilyValue,
} from "@/lib/theme/constants";

function readThemeFamily(): ThemeFamilyValue {
  if (typeof document === "undefined") {
    return "default";
  }

  return getThemeFamilyFromClassList(document.documentElement.classList);
}

export function useThemeFamily() {
  const [themeFamily, setThemeFamilyState] = React.useState<ThemeFamilyValue>(
    () => readThemeFamily(),
  );

  React.useEffect(() => {
    const syncThemeFamily = () => {
      setThemeFamilyState(readThemeFamily());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== PREFERRED_THEME_FAMILY_KEY) {
        return;
      }

      syncThemeFamily();
    };

    syncThemeFamily();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_FAMILY_CHANGE_EVENT, syncThemeFamily);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_FAMILY_CHANGE_EVENT, syncThemeFamily);
    };
  }, []);

  const setThemeFamily = React.useCallback((value: ThemeFamilyValue) => {
    const nextThemeFamily = persistThemeFamilyPreference(value);
    setThemeFamilyState(nextThemeFamily);
  }, []);

  return {
    themeFamily,
    setThemeFamily,
  };
}
