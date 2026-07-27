"use client";

import * as React from "react";
import {
  PREFERRED_THEME_FAMILY_KEY,
  RESOLVED_THEME_MODE_COOKIE_NAME,
  THEME_FAMILIES,
  THEME_FAMILY_COOKIE_MAX_AGE_SECONDS,
  THEME_FAMILY_OPTIONS,
  THEME_MODE_COOKIE_MAX_AGE_SECONDS,
  THEME_MODE_COOKIE_NAME,
  THEME_MODE_STORAGE_KEY,
  normalizeThemeFamily,
  normalizeThemeMode,
  type ThemeFamilyOption,
  type ThemeFamilyValue,
  type ThemeModeValue,
} from "@/lib/theme/constants";

export {
  PREFERRED_THEME_FAMILY_KEY,
  THEME_FAMILY_OPTIONS,
  THEME_MODE_COOKIE_NAME,
  THEME_MODE_OPTIONS,
  THEME_MODE_STORAGE_KEY,
  getThemeModeScript,
} from "@/lib/theme/constants";
export type {
  ThemeFamilyOption,
  ThemeFamilyValue,
  ThemeModeValue,
} from "@/lib/theme/constants";

export const THEME_FAMILY_CHANGE_EVENT = "theme-family-change";
export const THEME_MODE_CHANGE_EVENT = "theme-mode-change";

type ThemeFamilySwatch = ThemeFamilyOption & {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type ThemeProviderProps = {
  attribute?: "class";
  children: React.ReactNode;
  defaultTheme?: ThemeModeValue;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  initialResolvedTheme?: "light" | "dark";
  initialTheme?: ThemeModeValue;
};

type ThemeContextValue = {
  resolvedTheme: "light" | "dark";
  setTheme: (value: ThemeModeValue) => void;
  theme: ThemeModeValue;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribeToSystemTheme(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function subscribeToThemeMode(onStoreChange: () => void) {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === THEME_MODE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(THEME_MODE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(THEME_MODE_CHANGE_EVENT, onStoreChange);
  };
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style");

  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      document.head.removeChild(style);
    }, 1);
  };
}

function resolveThemeMode(theme: ThemeModeValue): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

function applyThemeModeToDocument(
  theme: ThemeModeValue,
  disableTransitionsOnChange: boolean,
) {
  const cleanupTransitions = disableTransitionsOnChange
    ? disableTransitionsTemporarily()
    : null;
  const resolvedTheme = resolveThemeMode(theme);
  const root = document.documentElement;

  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;

  cleanupTransitions?.();

  return resolvedTheme;
}

function readStoredThemeMode(defaultTheme: ThemeModeValue) {
  try {
    return normalizeThemeMode(
      window.localStorage.getItem(THEME_MODE_STORAGE_KEY) ?? defaultTheme,
    );
  } catch {
    return defaultTheme;
  }
}

function persistThemeModeCookie(value: ThemeModeValue) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${THEME_MODE_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${THEME_MODE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function persistResolvedThemeModeCookie(value: "light" | "dark") {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${RESOLVED_THEME_MODE_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${THEME_MODE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function persistThemeModeValue(value: ThemeModeValue) {
  try {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, value);
  } catch {
    // Ignore storage write failures and still apply the selected theme.
  }

  persistThemeModeCookie(value);
  window.dispatchEvent(new Event(THEME_MODE_CHANGE_EVENT));
}

export function useTheme() {
  const context = React.useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return context;
}

export function removeAllThemeFamilyClasses(target: DOMTokenList) {
  THEME_FAMILIES.forEach((themeFamily) => target.remove(themeFamily));
}

export function getThemeFamilyFromClassList(
  classList: DOMTokenList,
): ThemeFamilyValue {
  const activeThemeFamily = THEME_FAMILIES.find((themeFamily) =>
    classList.contains(themeFamily),
  );

  return activeThemeFamily ?? "default";
}

export function applyThemeFamilyClass(
  preferredThemeFamily: string | null | undefined,
) {
  if (typeof document === "undefined") {
    return;
  }

  const classList = document.documentElement.classList;
  const nextThemeFamily = normalizeThemeFamily(preferredThemeFamily);

  removeAllThemeFamilyClasses(classList);

  if (nextThemeFamily !== "default") {
    classList.add(nextThemeFamily);
  }
}

export function setThemeFamilyCookie(value: string) {
  if (typeof document === "undefined") {
    return;
  }

  const nextThemeFamily = normalizeThemeFamily(value);

  try {
    const secure =
      window.location.protocol === "https:" ? "; Secure" : "";

    document.cookie = `${PREFERRED_THEME_FAMILY_KEY}=${encodeURIComponent(nextThemeFamily)}; path=/; max-age=${THEME_FAMILY_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Ignore cookie write failures and keep the in-memory theme selection.
  }
}

export function persistThemeFamilyPreference(
  value: string | null | undefined,
): ThemeFamilyValue {
  const nextThemeFamily = normalizeThemeFamily(value);

  try {
    window.localStorage.setItem(PREFERRED_THEME_FAMILY_KEY, nextThemeFamily);
  } catch {
    // Ignore storage write failures and still apply the selected family.
  }

  applyThemeFamilyClass(nextThemeFamily);
  setThemeFamilyCookie(nextThemeFamily);
  window.dispatchEvent(new Event(THEME_FAMILY_CHANGE_EVENT));

  return nextThemeFamily;
}

export function computeThemeFamilySwatches(): ThemeFamilySwatch[] {
  if (typeof document === "undefined") {
    return THEME_FAMILY_OPTIONS.map((option) => ({
      ...option,
      primaryColor: "currentColor",
      secondaryColor: "currentColor",
      accentColor: "currentColor",
    }));
  }

  const root = document.documentElement;
  const originalThemeFamily = getThemeFamilyFromClassList(root.classList);

  try {
    return THEME_FAMILY_OPTIONS.map((option) => {
      applyThemeFamilyClass(option.value);

      return {
        ...option,
        primaryColor:
          getComputedStyle(root).getPropertyValue("--primary").trim() ||
          "currentColor",
        secondaryColor:
          getComputedStyle(root).getPropertyValue("--secondary").trim() ||
          "currentColor",
        accentColor:
          getComputedStyle(root).getPropertyValue("--accent").trim() ||
          "currentColor",
      };
    });
  } finally {
    applyThemeFamilyClass(originalThemeFamily);
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  disableTransitionOnChange = false,
  initialResolvedTheme = "light",
  initialTheme,
}: ThemeProviderProps) {
  const serverTheme = initialTheme ?? defaultTheme;
  const getThemeSnapshot = React.useCallback(
    () => readStoredThemeMode(serverTheme),
    [serverTheme],
  );
  const theme = React.useSyncExternalStore(
    subscribeToThemeMode,
    getThemeSnapshot,
    () => serverTheme,
  );
  const systemTheme = React.useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemTheme,
    () => initialResolvedTheme,
  );
  const resolvedTheme = theme === "system" ? systemTheme : theme;

  React.useEffect(() => {
    const syncPersistedThemeFamily = () => {
      const activeThemeFamily = getThemeFamilyFromClassList(
        document.documentElement.classList,
      );

      try {
        window.localStorage.setItem(PREFERRED_THEME_FAMILY_KEY, activeThemeFamily);
      } catch {
        // Ignore storage write failures and keep the server-rendered class.
      }

      setThemeFamilyCookie(activeThemeFamily);
      window.dispatchEvent(new Event(THEME_FAMILY_CHANGE_EVENT));
    };

    syncPersistedThemeFamily();
  }, []);

  React.useEffect(() => {
    const resolved = applyThemeModeToDocument(theme, disableTransitionOnChange);

    persistThemeModeCookie(theme);
    persistResolvedThemeModeCookie(resolved);
    window.dispatchEvent(new Event(THEME_MODE_CHANGE_EVENT));
  }, [disableTransitionOnChange, resolvedTheme, theme]);

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (!event.key) {
        return;
      }

      if (event.key === PREFERRED_THEME_FAMILY_KEY) {
        const nextThemeFamily = normalizeThemeFamily(event.newValue);
        applyThemeFamilyClass(nextThemeFamily);
        setThemeFamilyCookie(nextThemeFamily);
        window.dispatchEvent(new Event(THEME_FAMILY_CHANGE_EVENT));
      }

    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setTheme = React.useCallback((value: ThemeModeValue) => {
    persistThemeModeValue(value);
  }, []);

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
