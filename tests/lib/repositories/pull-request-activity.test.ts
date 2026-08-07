import {
  describePullRequestActivity,
  isPullRequestActivityThread,
} from "@/lib/repositories/pull-request-activity";
import type {
  AzureGitPullRequestThread,
  AzureGitPullRequestThreadActivity,
} from "@/lib/azure-devops/git/types";

function createThread({
  activity,
  content,
}: {
  activity?: Partial<AzureGitPullRequestThreadActivity> & {
    type: AzureGitPullRequestThreadActivity["type"];
  };
  content: string;
}): AzureGitPullRequestThread {
  return {
    activity: activity
      ? {
          actor: null,
          newCommitCount: null,
          refName: null,
          voteResult: null,
          ...activity,
        }
      : null,
    changeTrackingId: null,
    comments: [
      {
        author: {
          displayName: "Oliver Quezon",
          id: null,
          imageUrl: null,
          isContainer: false,
        },
        content,
        id: 1,
        isDeleted: false,
        lastUpdatedDate: null,
        parentCommentId: 0,
        publishedDate: null,
        type: "system",
        usersLiked: [],
      },
    ],
    filePath: null,
    id: 1,
    isDeleted: false,
    iterationContext: null,
    lastUpdatedDate: null,
    leftFileEnd: null,
    leftFileStart: null,
    publishedDate: null,
    rightFileEnd: null,
    rightFileStart: null,
    status: "unknown",
  };
}

describe("isPullRequestActivityThread", () => {
  it("treats a thread carrying a code review thread type as activity", () => {
    expect(
      isPullRequestActivityThread(
        createThread({
          activity: { type: "voteUpdate" },
          content: "Oliver Quezon voted 10",
        }),
      ),
    ).toBe(true);
  });

  it("treats an ordinary comment thread as discussion", () => {
    expect(
      isPullRequestActivityThread(createThread({ content: "Looks good" })),
    ).toBe(false);
  });
});

describe("describePullRequestActivity", () => {
  it("replaces a raw vote value with the vote meaning", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: { type: "voteUpdate", voteResult: 10 },
          content: "Oliver Quezon voted 10",
        }),
      ),
    ).toBe("Oliver Quezon approved this pull request");
  });

  it("attributes structured activity to its real actor", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: {
            actor: {
              displayName: "Ada Lovelace",
              id: "ada",
              imageUrl: null,
              isContainer: false,
            },
            type: "voteUpdate",
            voteResult: 10,
          },
          content: "Microsoft.VisualStudio.Services.TFS voted 10",
        }),
      ),
    ).toBe("Ada Lovelace approved this pull request");
  });

  it("describes a negative vote without exposing the number", () => {
    const text = describePullRequestActivity(
      createThread({
        activity: { type: "voteUpdate", voteResult: -5 },
        content: "Oliver Quezon voted -5",
      }),
    );

    expect(text).toBe("Oliver Quezon is waiting for the author");
    expect(text).not.toContain("-5");
  });

  it("summarises a ref update with the commit count and short branch", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: {
            newCommitCount: 1,
            refName: "refs/heads/Oliver/23141_fix",
            type: "refUpdate",
          },
          content: "The reference refs/heads/Oliver/23141_fix was updated.",
        }),
      ),
    ).toBe("Pushed 1 commit to Oliver/23141_fix");
  });

  it("pluralises multiple pushed commits", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: {
            newCommitCount: 3,
            refName: "refs/heads/main",
            type: "refUpdate",
          },
          content: "The reference refs/heads/main was updated.",
        }),
      ),
    ).toBe("Pushed 3 commits to main");
  });

  it("shortens the policy status message", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: { type: "policyStatusUpdate" },
          content: "Policy status has been updated",
        }),
      ),
    ).toBe("Policy status updated");
  });

  it("keeps the original text for reviewer updates that already read well", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: { type: "reviewersUpdate" },
          content: "Austin Smith added Lukas Hart as a reviewer",
        }),
      ),
    ).toBe("Austin Smith added Lukas Hart as a reviewer");
  });

  it("falls back to the comment when the vote value is missing", () => {
    expect(
      describePullRequestActivity(
        createThread({
          activity: { type: "voteUpdate" },
          content: "Oliver Quezon voted 10",
        }),
      ),
    ).toBe("Oliver Quezon voted 10");
  });
});
