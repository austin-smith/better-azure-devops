import {
  normalizeAzureDevOpsMarkdownMentions,
  sanitizeAzureDevOpsHtml,
} from "@/lib/azure-devops/markup";

describe("Azure DevOps markup", () => {
  it("normalizes known markdown mentions into safe non-navigation links", () => {
    expect(
      normalizeAzureDevOpsMarkdownMentions(
        "Hello @<ADA-ID> and @<unknown>.",
        new Map([["ada-id", "Ada [Admin]"]]),
      ),
    ).toBe(
      "Hello [Ada \\[Admin\\]](./ado-mention/ada-id) and @<unknown>.",
    );
  });

  it("removes unsafe HTML while preserving Azure mention metadata", () => {
    expect(
      sanitizeAzureDevOpsHtml(
        '<script>alert(1)</script><a data-vss-mention="aad,ada">Ada</a>',
      ),
    ).toBe(
      '<span data-vss-mention="aad,ada">Ada</span>',
    );
  });
});
