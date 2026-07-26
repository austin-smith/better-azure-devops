import { parsePullRequestThreadList } from "@/lib/azure-devops/git/parsers";

const SERVICE_ACCOUNT = {
  displayName: "Microsoft.VisualStudio.Services.TFS",
  id: "00000002-0000-8888-8000-000000000000",
  imageUrl: "https://dev.azure.com/example/_api/_common/identityImage?id=svc",
};

const AUSTIN = {
  displayName: "Austin Smith",
  id: "36b6e2d8-0a5e-4e17-b7f8-9ad2bea87fc1",
  imageUrl:
    "https://dev.azure.com/example/_apis/GraphProfile/MemberAvatars/aad.austin",
};

function property(value: number | string) {
  return {
    $type: typeof value === "number" ? "System.Int32" : "System.String",
    $value: value,
  };
}

function createThread({
  identities,
  properties,
}: {
  identities?: Record<string, unknown>;
  properties: Record<string, unknown>;
}) {
  return parsePullRequestThreadList({
    value: [
      {
        comments: [
          {
            author: SERVICE_ACCOUNT,
            commentType: "system",
            content: "Austin Smith published the pull request.",
            id: 1,
            parentCommentId: 0,
          },
        ],
        id: 10,
        identities,
        properties,
      },
    ],
  })[0];
}

describe("pull request activity actor", () => {
  it("resolves a ref update to the person who pushed", () => {
    const thread = createThread({
      identities: { "1": AUSTIN },
      properties: {
        CodeReviewRefUpdatedByIdentity: property("1"),
        CodeReviewThreadType: property("RefUpdate"),
      },
    });

    expect(thread?.activity?.actor?.displayName).toBe("Austin Smith");
    expect(thread?.activity?.actor?.imageUrl).toBe(AUSTIN.imageUrl);
  });

  it("does not attribute the event to the service account that authored it", () => {
    const thread = createThread({
      identities: { "1": AUSTIN },
      properties: {
        CodeReviewIsDraftUpdatedByIdentity: property("1"),
        CodeReviewThreadType: property("IsDraftUpdate"),
      },
    });

    expect(thread?.comments[0]?.author.displayName).toBe(
      SERVICE_ACCOUNT.displayName,
    );
    expect(thread?.activity?.actor?.displayName).toBe("Austin Smith");
  });

  it("resolves the voter rather than the vote initiator", () => {
    const thread = createThread({
      identities: { "1": AUSTIN, "2": SERVICE_ACCOUNT },
      properties: {
        CodeReviewThreadType: property("VoteUpdate"),
        CodeReviewVoteResult: property("10"),
        CodeReviewVotedByIdentity: property("1"),
        CodeReviewVotedByInitiatorIdentity: property("2"),
      },
    });

    expect(thread?.activity?.actor?.displayName).toBe("Austin Smith");
  });

  it("ignores the added reviewer and reports who added them", () => {
    const thread = createThread({
      identities: { "1": AUSTIN, "2": SERVICE_ACCOUNT },
      properties: {
        CodeReviewReviewersUpdatedAddedIdentity: property("2"),
        CodeReviewReviewersUpdatedByIdentity: property("1"),
        CodeReviewThreadType: property("ReviewersUpdate"),
      },
    });

    expect(thread?.activity?.actor?.displayName).toBe("Austin Smith");
  });

  it("has no actor when the event names none", () => {
    const thread = createThread({
      identities: { "1": AUSTIN },
      properties: {
        CodeReviewRequiredReviewerExampleReviewerIdentities: property('["1"]'),
        CodeReviewThreadType: property("PolicyStatusUpdate"),
      },
    });

    expect(thread?.activity?.actor).toBeNull();
  });

  it("has no actor when the identity map does not contain the key", () => {
    const thread = createThread({
      identities: { "2": AUSTIN },
      properties: {
        CodeReviewRefUpdatedByIdentity: property("1"),
        CodeReviewThreadType: property("RefUpdate"),
      },
    });

    expect(thread?.activity?.actor).toBeNull();
  });

  it("recognises a draft publish as its own activity type", () => {
    const thread = createThread({
      identities: { "1": AUSTIN },
      properties: {
        CodeReviewIsDraftUpdatedByIdentity: property("1"),
        CodeReviewThreadType: property("IsDraftUpdate"),
      },
    });

    expect(thread?.activity?.type).toBe("isDraftUpdate");
  });
});
