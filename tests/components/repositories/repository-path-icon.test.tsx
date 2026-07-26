import {
  DefaultFileIcon,
  DefaultFolderIcon,
} from "@react-symbols/icons/utils";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getRepositoryPathName,
  RepositoryPathIcon,
} from "@/components/repositories/repository-path-icon";

const DECORATIVE_ICON_PROPS = {
  "aria-hidden": true,
  className: "size-4 shrink-0",
  focusable: "false",
} as const;

function renderRepositoryIcon(kind: "file" | "folder", path: string) {
  return renderToStaticMarkup(
    <RepositoryPathIcon kind={kind} path={path} />,
  );
}

describe("RepositoryPathIcon", () => {
  it.each([
    ["/src/components/Button.tsx", "button.tsx"],
    ["/src/components/", "components"],
    [".gitignore", ".gitignore"],
    ["/LICENSE", "license"],
    ["/", ""],
  ])("normalizes the basename for %s", (path, expected) => {
    expect(getRepositoryPathName(path)).toBe(expected);
  });

  it("renders decorative icons with a stable layout footprint", () => {
    const markup = renderToStaticMarkup(
      <RepositoryPathIcon
        className="custom-class"
        kind="file"
        path="src/app/page.tsx"
      />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('focusable="false"');
    expect(markup).toContain('class="size-4 shrink-0 custom-class"');
    expect(markup).not.toContain("aria-label");
  });

  it("handles file extensions and folder names case-insensitively", () => {
    expect(renderRepositoryIcon("file", "APP.TSX")).toBe(
      renderRepositoryIcon("file", "app.tsx"),
    );
    expect(renderRepositoryIcon("folder", "/SRC/")).toBe(
      renderRepositoryIcon("folder", "src"),
    );
  });

  it.each([
    "README.md",
    "LICENSE",
    ".gitignore",
    "Dockerfile",
    "package.json",
    "pnpm-lock.yaml",
    "next.config.ts",
    "src/app/page.tsx",
    "server.py",
    "Program.cs",
    "infra/main.tf",
    "assets/logo.PNG",
    "docs/guide.MD",
    "dist/archive.tar.gz",
  ])("resolves a specific icon for %s", (path) => {
    const defaultMarkup = renderToStaticMarkup(
      <DefaultFileIcon {...DECORATIVE_ICON_PROPS} />,
    );

    expect(renderRepositoryIcon("file", path)).not.toBe(defaultMarkup);
  });

  it("uses filename mappings before generic extension mappings", () => {
    expect(renderRepositoryIcon("file", "package.json")).not.toBe(
      renderRepositoryIcon("file", "data.json"),
    );
    expect(renderRepositoryIcon("file", "pnpm-lock.yaml")).not.toBe(
      renderRepositoryIcon("file", "data.yaml"),
    );
    expect(renderRepositoryIcon("file", "next.config.ts")).not.toBe(
      renderRepositoryIcon("file", "example.ts"),
    );
  });

  it("uses package defaults for unknown files and folders", () => {
    const defaultFileMarkup = renderToStaticMarkup(
      <DefaultFileIcon {...DECORATIVE_ICON_PROPS} />,
    );
    const defaultFolderMarkup = renderToStaticMarkup(
      <DefaultFolderIcon {...DECORATIVE_ICON_PROPS} />,
    );

    expect(
      renderRepositoryIcon("file", "unknown.custom-unmapped-extension"),
    ).toBe(defaultFileMarkup);
    expect(renderRepositoryIcon("folder", "unmapped-folder")).toBe(
      defaultFolderMarkup,
    );
  });
});
