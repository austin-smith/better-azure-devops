import { describe, expect, it } from "vitest";
import {
  getRepositoryFileLineHash,
  parseRepositoryFileLineHash,
  REPOSITORY_FILE_OPTIONS,
} from "@/lib/repositories/pierre-file";

describe("repository file rendering", () => {
  it("uses serializable stable rendering options", () => {
    expect(REPOSITORY_FILE_OPTIONS).toMatchObject({
      disableFileHeader: true,
      enableLineSelection: true,
      overflow: "scroll",
      themeType: "system",
    });
    expect(JSON.parse(JSON.stringify(REPOSITORY_FILE_OPTIONS))).toEqual(
      REPOSITORY_FILE_OPTIONS,
    );
  });

  it("parses legacy single-line and range hashes", () => {
    expect(parseRepositoryFileLineHash("#L12")).toEqual({
      end: 12,
      start: 12,
    });
    expect(parseRepositoryFileLineHash("#L20-L7")).toEqual({
      end: 20,
      start: 7,
    });
  });

  it("rejects malformed and zero-based hashes", () => {
    expect(parseRepositoryFileLineHash("#L0")).toBeNull();
    expect(parseRepositoryFileLineHash("#L1-old")).toBeNull();
    expect(parseRepositoryFileLineHash("#line-1")).toBeNull();
  });

  it("serializes normalized selections with blob-compatible hashes", () => {
    expect(getRepositoryFileLineHash({ end: 9, start: 9 })).toBe("#L9");
    expect(getRepositoryFileLineHash({ end: 3, start: 8 })).toBe("#L3-L8");
  });
});
