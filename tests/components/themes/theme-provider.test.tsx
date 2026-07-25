// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import {
  ThemeProvider,
  useTheme,
} from "@/components/themes/theme-provider";

function ThemeProbe() {
  const { resolvedTheme, theme } = useTheme();

  return <span>{theme}:{resolvedTheme}</span>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: true,
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the server-resolved theme for the initial render", () => {
    const markup = renderToString(
      <ThemeProvider initialResolvedTheme="dark" initialTheme="system">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(markup).toContain("system");
    expect(markup).toContain("dark");
  });

  it("uses the server-resolved theme before browser effects sync", () => {
    render(
      <ThemeProvider initialResolvedTheme="dark" initialTheme="system">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByText("system:dark")).toBeInTheDocument();
  });
});
