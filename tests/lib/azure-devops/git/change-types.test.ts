import {
  getAzureGitChangeTypes,
  hasAzureGitChangeType,
} from "@/lib/azure-devops/git/change-types";

describe("Azure Git change types", () => {
  it("parses comma-separated change flags", () => {
    expect(getAzureGitChangeTypes("rename, edit")).toEqual(
      new Set(["rename", "edit"]),
    );
  });

  it("does not confuse undelete with delete", () => {
    expect(hasAzureGitChangeType("undelete", "delete")).toBe(false);
    expect(hasAzureGitChangeType("undelete", "undelete")).toBe(true);
  });
});
