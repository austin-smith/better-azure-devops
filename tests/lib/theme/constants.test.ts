import {
  getThemeModeScript,
  resolveServerThemeMode,
} from "@/lib/theme/constants";

describe("theme constants", () => {
  it("resolves an explicit server theme without the resolved cookie", () => {
    expect(resolveServerThemeMode("dark", null)).toBe("dark");
    expect(resolveServerThemeMode("light", "dark")).toBe("light");
  });

  it("uses the resolved theme cookie when the saved mode is system", () => {
    expect(resolveServerThemeMode("system", "dark")).toBe("dark");
    expect(resolveServerThemeMode("system", "light")).toBe("light");
  });

  it("falls back to light when persisted values are missing or invalid", () => {
    expect(resolveServerThemeMode(null, null)).toBe("light");
    expect(resolveServerThemeMode("system", "sepia")).toBe("light");
    expect(resolveServerThemeMode("sepia", "dark")).toBe("dark");
  });

  it("bootstraps both theme cookies in the init script", () => {
    const script = getThemeModeScript();

    expect(script).toContain("resolved-theme");
    expect(script).toContain("writeCookie(themeCookieName, theme);");
    expect(script).toContain("writeCookie(resolvedThemeCookieName, resolved);");
  });
});
