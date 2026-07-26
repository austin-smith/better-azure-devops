import type { AzureGitPullRequestReviewer } from "@/lib/azure-devops/git/types";
import {
  getCheckTone,
  getMergeStatePresentation,
  getPullRequestReviewSummary,
  getPullRequestStatePresentation,
} from "@/lib/repositories/pull-request-presentation";

function createReviewer(
  overrides: Partial<AzureGitPullRequestReviewer>,
): AzureGitPullRequestReviewer {
  return {
    displayName: "Reviewer",
    hasDeclined: false,
    id: "reviewer",
    imageUrl: null,
    isContainer: false,
    isFlagged: false,
    isRequired: false,
    vote: 0,
    votedFor: [],
    ...overrides,
  };
}

describe("getPullRequestReviewSummary", () => {
  it("counts only required reviewers toward required approvals", () => {
    expect(
      getPullRequestReviewSummary([
        createReviewer({ id: "required", isRequired: true, vote: 0 }),
        createReviewer({ id: "optional", vote: 10 }),
      ]),
    ).toEqual({
      label: "0 of 1 required approvals",
      tone: "pending",
    });
  });

  it("marks the requirement complete when every required reviewer approves", () => {
    expect(
      getPullRequestReviewSummary([
        createReviewer({ id: "required", isRequired: true, vote: 5 }),
      ]),
    ).toEqual({
      label: "1 of 1 required approvals",
      tone: "positive",
    });
  });

  it("treats waiting for author as pending rather than rejected", () => {
    expect(
      getPullRequestReviewSummary([
        createReviewer({ id: "reviewer", vote: -5 }),
      ]),
    ).toEqual({
      label: "0 approvals",
      tone: "pending",
    });
  });
});

describe("pull request check presentation", () => {
  it("treats non-applicable checks as neutral", () => {
    expect(getCheckTone("notApplicable")).toBe("neutral");
  });

  it("distinguishes conflicts from other merge failures", () => {
    expect(getMergeStatePresentation("conflicts")?.label).toBe("Conflicts");
    expect(getMergeStatePresentation("failure")?.label).toBe("Merge failed");
    expect(getMergeStatePresentation("rejectedByPolicy")?.label).toBe(
      "Policy rejected",
    );
  });
});

describe("getPullRequestStatePresentation", () => {
  it("shows an abandoned draft as abandoned", () => {
    expect(
      getPullRequestStatePresentation({
        isDraft: true,
        status: "abandoned",
      }).label,
    ).toBe("Abandoned");
  });
});
