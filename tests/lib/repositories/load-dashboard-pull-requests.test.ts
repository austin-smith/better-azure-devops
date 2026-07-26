import type { AzureGitPullRequestReviewer } from "@/lib/azure-devops/git/types";
import { isReviewerAwaitingReview } from "@/lib/repositories/load-dashboard-pull-requests";

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

describe("isReviewerAwaitingReview", () => {
  it("excludes review assignments the user declined", () => {
    expect(
      isReviewerAwaitingReview(
        [createReviewer({ hasDeclined: true })],
        "reviewer",
      ),
    ).toBe(false);
  });

  it("includes an assigned reviewer who has not voted", () => {
    expect(
      isReviewerAwaitingReview([createReviewer({})], "REVIEWER"),
    ).toBe(true);
  });
});
