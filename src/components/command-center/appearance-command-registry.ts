import { PaletteIcon } from "lucide-react";
import type {
  CommandCenterGroup,
} from "@/components/command-center/command-registry";
import type { ThemeFamilyValue, ThemeModeValue } from "@/lib/theme/constants";
import {
  THEME_FAMILY_OPTIONS,
  THEME_MODE_OPTIONS,
} from "@/lib/theme/constants";

type BuildAppearanceCommandGroupsOptions = {
  setThemeFamily: (value: ThemeFamilyValue) => void;
  setThemeMode: (value: ThemeModeValue) => void;
  themeFamily: ThemeFamilyValue;
  themeMode: ThemeModeValue;
};

export function buildAppearanceCommandGroups({
  setThemeFamily,
  setThemeMode,
  themeFamily,
  themeMode,
}: BuildAppearanceCommandGroupsOptions): CommandCenterGroup[] {
  return [
    {
      actions: THEME_MODE_OPTIONS.map((option) => ({
        checked: themeMode === option.value,
        description:
          option.value === "system"
            ? "Follow your operating system appearance"
            : `Use ${option.label.toLowerCase()} mode`,
        icon: option.icon,
        id: `theme-mode-${option.value}`,
        keepOpen: true,
        keywords: ["appearance", "color", "theme", "mode"],
        label: `${option.label} mode`,
        run: () => setThemeMode(option.value),
      })),
      heading: "Theme mode",
      id: "theme-mode",
    },
    {
      actions: THEME_FAMILY_OPTIONS.map((option) => ({
        checked: themeFamily === option.value,
        description: `Use the ${option.label.toLowerCase()} visual style`,
        icon: PaletteIcon,
        id: `theme-family-${option.value}`,
        keepOpen: true,
        keywords: ["appearance", "font", "style", "theme"],
        label: `${option.label} style`,
        run: () => setThemeFamily(option.value),
      })),
      heading: "Theme style",
      id: "theme-family",
    },
  ];
}
