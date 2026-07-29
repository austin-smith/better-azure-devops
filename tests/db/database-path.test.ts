import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ensureDatabaseDirectory,
  getDatabasePath,
} from "@/db/database-path";

describe("database path", () => {
  const originalOverride = process.env.LOCAL_SETTINGS_DATABASE_PATH;

  afterEach(() => {
    vi.restoreAllMocks();

    if (originalOverride === undefined) {
      delete process.env.LOCAL_SETTINGS_DATABASE_PATH;
    } else {
      process.env.LOCAL_SETTINGS_DATABASE_PATH = originalOverride;
    }
  });

  it("uses the Better ADO data directory by default", () => {
    delete process.env.LOCAL_SETTINGS_DATABASE_PATH;
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(
      getDatabasePath().endsWith(
        path.join(".better-ado", "settings.sqlite"),
      ),
    ).toBe(true);
  });

  it("preserves an existing database from the previous app directory", () => {
    delete process.env.LOCAL_SETTINGS_DATABASE_PATH;
    vi.spyOn(fs, "existsSync").mockImplementation((value) =>
      String(value).endsWith(
        path.join(
          ".better-azure-devops",
          "settings.sqlite",
        ),
      ),
    );

    expect(
      getDatabasePath().endsWith(
        path.join(
          ".better-azure-devops",
          "settings.sqlite",
        ),
      ),
    ).toBe(true);
  });

  it("prefers the current database when both app directories exist", () => {
    delete process.env.LOCAL_SETTINGS_DATABASE_PATH;
    vi.spyOn(fs, "existsSync").mockReturnValue(true);

    expect(
      getDatabasePath().endsWith(
        path.join(".better-ado", "settings.sqlite"),
      ),
    ).toBe(true);
  });

  it("uses and prepares an explicit database path", () => {
    const databasePath = path.join(
      tmpdir(),
      `better-ado-path-${Date.now()}`,
      "settings.sqlite",
    );

    process.env.LOCAL_SETTINGS_DATABASE_PATH = ` ${databasePath} `;
    ensureDatabaseDirectory(getDatabasePath());

    expect(getDatabasePath()).toBe(databasePath);
  });
});
