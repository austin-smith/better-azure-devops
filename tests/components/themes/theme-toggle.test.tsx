// @vitest-environment jsdom

import { renderToString } from "react-dom/server";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { ThemeToggle } from "@/components/themes/theme-toggle";

describe("ThemeToggle", () => {
  it("renders a stable system trigger across server-resolved light and dark themes", () => {
    const lightMarkup = renderToString(
      <ThemeProvider initialResolvedTheme="light" initialTheme="system">
        <ThemeToggle />
      </ThemeProvider>,
    );
    const darkMarkup = renderToString(
      <ThemeProvider initialResolvedTheme="dark" initialTheme="system">
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(lightMarkup).toContain("Theme: System");
    expect(darkMarkup).toContain("Theme: System");
    expect(lightMarkup).not.toContain("Theme: Light (System)");
    expect(darkMarkup).not.toContain("Theme: Dark (System)");
  });

  it("uses the shared button icon convention on the trigger icon", () => {
    const markup = renderToString(
      <ThemeProvider initialResolvedTheme="dark" initialTheme="system">
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(markup).toContain('data-icon="inline-start"');
  });
});
