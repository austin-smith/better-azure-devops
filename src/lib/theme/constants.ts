import {
  Monitor,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

export const PREFERRED_THEME_FAMILY_KEY = "user-preferred-theme-family";
export const THEME_FAMILY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const THEME_MODE_STORAGE_KEY = "theme";
export const THEME_MODE_COOKIE_NAME = "theme";
export const THEME_MODE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const THEME_MODE_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export type ThemeModeOption = (typeof THEME_MODE_OPTIONS)[number];
export type ThemeModeValue = ThemeModeOption["value"];

export const THEME_MODE_ICON_MAP: Record<ThemeModeValue, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export const THEME_FAMILY_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "mono", label: "Mono" },
  { value: "perpetuity", label: "Perpetuity" },
] as const;

export type ThemeFamilyOption = (typeof THEME_FAMILY_OPTIONS)[number];
export type ThemeFamilyValue = ThemeFamilyOption["value"];
export type KnownThemeFamily = Exclude<ThemeFamilyValue, "default">;

export const THEME_FAMILIES = THEME_FAMILY_OPTIONS
  .filter((option) => option.value !== "default")
  .map((option) => option.value) as readonly KnownThemeFamily[];

export function isThemeMode(value: string): value is ThemeModeValue {
  return THEME_MODE_OPTIONS.some((option) => option.value === value);
}

export function isThemeFamily(value: string): value is ThemeFamilyValue {
  return THEME_FAMILY_OPTIONS.some((option) => option.value === value);
}

export function isKnownThemeFamily(value: string): value is KnownThemeFamily {
  return THEME_FAMILIES.includes(value as KnownThemeFamily);
}

export function normalizeThemeMode(
  value: string | null | undefined,
): ThemeModeValue {
  return value && isThemeMode(value) ? value : "system";
}

export function normalizeThemeFamily(
  value: string | null | undefined,
): ThemeFamilyValue {
  return value && isThemeFamily(value) ? value : "default";
}

export function getNextThemeMode(
  currentMode: ThemeModeValue | undefined,
): ThemeModeValue {
  const orderedValues = THEME_MODE_OPTIONS.map((option) => option.value);
  const currentIndex = currentMode ? orderedValues.indexOf(currentMode) : -1;
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % orderedValues.length : 0;

  return orderedValues[nextIndex] ?? "light";
}

export function getThemeModeScript() {
  return `
    (() => {
      const storageKey = ${JSON.stringify(THEME_MODE_STORAGE_KEY)};
      const darkClass = "dark";
      const root = document.documentElement;
      const getSystemTheme = () =>
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

      try {
        const stored = localStorage.getItem(storageKey);
        const theme = stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system";
        const resolved = theme === "system" ? getSystemTheme() : theme;

        root.classList.toggle(darkClass, resolved === "dark");
        root.style.colorScheme = resolved;
      } catch {
        const resolved = getSystemTheme();
        root.classList.toggle(darkClass, resolved === "dark");
        root.style.colorScheme = resolved;
      }
    })();
  `;
}
