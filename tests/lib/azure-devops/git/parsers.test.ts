import {
  parseCommitChanges,
  parseCommitDetail,
  parseGitItemList,
  parsePolicyEvaluationList,
  parsePullRequest,
  parsePullRequestChangeList,
  parsePullRequestIterationList,
  parsePullRequestStatusList,
  parsePullRequestThreadList,
  parsePushList,
  parseRepository,
  parseSearchResults,
} from "@/lib/azure-devops/git/parsers";
import { AzureDevOpsDataError } from "@/lib/azure-devops/errors";

describe("Azure Git response parsers", () => {
  it("normalizes repository identity and returned web links", () => {
    expect(
      parseRepository({
        _links: {
          web: {
            href: "https://dev.azure.com/example/Platform/_git/App",
          },
        },
        defaultBranch: "refs/heads/main",
        id: "repository-id",
        isFork: true,
        name: "App",
        project: {
          id: "project-id",
          name: "Platform",
        },
        size: 1234,
      }),
    ).toMatchObject({
      defaultBranch: "refs/heads/main",
      id: "repository-id",
      isFork: true,
      name: "App",
      project: {
        id: "project-id",
        name: "Platform",
      },
      size: 1234,
      webUrl: "https://dev.azure.com/example/Platform/_git/App",
    });
  });

  it("rejects repositories without stable IDs and projects", () => {
    expect(() =>
      parseRepository({
        name: "App",
      }),
    ).toThrow(AzureDevOpsDataError);
  });

  it("uses content metadata instead of guessing binary and image files", () => {
    expect(
      parseGitItemList({
        value: [
          {
            contentMetadata: {
              contentType: "image/svg+xml",
              fileName: "logo.svg",
              isBinary: false,
              isImage: true,
            },
            gitObjectType: "blob",
            isFolder: false,
            objectId: "blob-id",
            path: "/assets/logo.svg",
            size: 200,
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        contentMetadata: expect.objectContaining({
          isBinary: false,
          isImage: true,
          mimeType: "image/svg+xml",
        }),
        objectId: "blob-id",
        path: "/assets/logo.svg",
      }),
    ]);
  });

  it("parses sparse items returned by commit changes", () => {
    expect(
      parseCommitChanges({
        changes: [
          {
            changeId: 1,
            changeType: "edit",
            item: {
              gitObjectType: "blob",
              path: "/src/app.ts",
              url: "https://dev.azure.com/example/item",
            },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        item: {
          gitObjectType: "blob",
          isFolder: false,
          objectId: null,
          path: "/src/app.ts",
          url: "https://dev.azure.com/example/item",
        },
      }),
    ]);
  });

  it("normalizes commit overflow, parents, counts, and push data", () => {
    expect(
      parseCommitDetail({
        author: {
          date: "2026-07-25T00:00:00Z",
          name: "Ada",
        },
        changeCounts: {
          Add: 2,
          Edit: 3,
        },
        comment: "Build explorer",
        commitId: "abc123",
        commitTooManyChanges: true,
        parents: ["parent1"],
        push: {
          date: "2026-07-25T00:00:00Z",
          pushId: 10,
          pushedBy: {
            displayName: "Ada",
          },
        },
      }),
    ).toMatchObject({
      changeCounts: {
        Add: 2,
        Edit: 3,
      },
      parents: ["parent1"],
      push: {
        pushId: 10,
        pushedBy: "Ada",
      },
      tooManyChanges: true,
    });
  });

  it("preserves exact repository paths and Markdown text", () => {
    expect(
      parseGitItemList({
        value: [
          {
            objectId: "blob-id",
            path: "/docs/trailing-space ",
          },
        ],
      })[0]?.path,
    ).toBe("/docs/trailing-space ");

    expect(
      parseCommitDetail({
        comment: "  indented summary\nwith trailing space  ",
        commitId: "abc123",
      }).comment,
    ).toBe("  indented summary\nwith trailing space  ");

    expect(
      parsePullRequest({
        description: "  indented description\nwith trailing space  ",
        pullRequestId: 42,
        repository: {
          id: "target-repo",
          name: "App",
          project: {
            id: "target-project",
            name: "Platform",
          },
        },
        title: "Preserve Markdown",
      })?.description,
    ).toBe("  indented description\nwith trailing space  ");
  });

  it("retains target and fork source repository identity on pull requests", () => {
    expect(
      parsePullRequest({
        pullRequestId: 42,
        repository: {
          id: "target-repo",
          name: "App",
          project: {
            id: "target-project",
            name: "Platform",
          },
        },
        sourceRefName: "refs/heads/feature",
        forkSource: {
          repository: {
            id: "source-repo",
            project: {
              id: "source-project",
            },
          },
        },
        status: "active",
        targetRefName: "refs/heads/main",
        title: "Add repository browser",
        workItemRefs: [{ id: "123" }],
      }),
    ).toMatchObject({
      pullRequestId: 42,
      repository: {
        id: "target-repo",
        projectId: "target-project",
      },
      sourceRepository: {
        id: "source-repo",
        projectId: "source-project",
      },
      workItemIds: ["123"],
    });
  });

  it("normalizes reviewers, labels, merge commits, and iteration support", () => {
    expect(
      parsePullRequest({
        artifactId: "vstfs:///CodeReview/CodeReviewId/project/42",
        completionOptions: { mergeStrategy: "squash" },
        labels: [{ name: "frontend" }],
        lastMergeCommit: { commitId: "merge-commit" },
        lastMergeSourceCommit: { commitId: "source-commit" },
        lastMergeTargetCommit: { commitId: "target-commit" },
        pullRequestId: 42,
        repository: {
          id: "target-repo",
          name: "App",
          project: {
            id: "target-project",
            name: "Platform",
          },
        },
        reviewers: [
          {
            displayName: "Ada Lovelace",
            id: "reviewer-id",
            isRequired: true,
            vote: 10,
          },
        ],
        sourceRefName: "refs/heads/feature",
        status: "active",
        supportsIterations: true,
        targetRefName: "refs/heads/main",
        title: "Add review tools",
      }),
    ).toMatchObject({
      artifactId: "vstfs:///CodeReview/CodeReviewId/project/42",
      labels: ["frontend"],
      lastMergeCommitId: "merge-commit",
      lastMergeSourceCommitId: "source-commit",
      lastMergeTargetCommitId: "target-commit",
      mergeStrategy: "squash",
      reviewers: [
        {
          displayName: "Ada Lovelace",
          id: "reviewer-id",
          isRequired: true,
          vote: 10,
        },
      ],
      supportsIterations: true,
    });
  });

  it("normalizes the legacy squash-merge completion option", () => {
    expect(
      parsePullRequest({
        completionOptions: { squashMerge: true },
        pullRequestId: 42,
        repository: {
          id: "target-repo",
          name: "App",
          project: {
            id: "target-project",
            name: "Platform",
          },
        },
        title: "Legacy squash",
      }),
    ).toMatchObject({
      mergeStrategy: "squash",
    });
  });

  it("normalizes pull request threads with inline and iteration context", () => {
    expect(
      parsePullRequestThreadList({
        value: [
          {
            comments: [
              {
                author: {
                  displayName: "Grace Hopper",
                  id: "grace",
                },
                commentType: "text",
                content: "Please rename this.",
                id: 1,
                parentCommentId: 0,
                publishedDate: "2026-07-26T01:00:00Z",
                usersLiked: [
                  {
                    displayName: "Ada Lovelace",
                    id: "ada",
                  },
                ],
              },
            ],
            id: 7,
            pullRequestThreadContext: {
              changeTrackingId: 12,
              iterationContext: {
                firstComparingIteration: 0,
                secondComparingIteration: 3,
              },
            },
            status: "active",
            threadContext: {
              filePath: "/src/app.ts",
              rightFileEnd: { line: 9, offset: 1 },
              rightFileStart: { line: 8, offset: 1 },
            },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        changeTrackingId: 12,
        comments: [
          expect.objectContaining({
            author: expect.objectContaining({ id: "grace" }),
            content: "Please rename this.",
            usersLiked: [
              expect.objectContaining({
                displayName: "Ada Lovelace",
              }),
            ],
          }),
        ],
        filePath: "/src/app.ts",
        id: 7,
        iterationContext: {
          firstComparingIteration: 0,
          secondComparingIteration: 3,
        },
        rightFileEnd: { line: 9, offset: 1 },
        rightFileStart: { line: 8, offset: 1 },
        status: "active",
      }),
    ]);
  });

  it("preserves whitespace in pull request Markdown comments", () => {
    const [thread] = parsePullRequestThreadList({
      value: [
        {
          comments: [
            {
              author: {
                displayName: "Grace Hopper",
                id: "grace",
              },
              commentType: "text",
              content: "  indented\nline  \n",
              id: 1,
              parentCommentId: 0,
            },
          ],
          id: 7,
          status: "active",
        },
      ],
    });

    expect(thread?.comments[0]?.content).toBe("  indented\nline  \n");
  });

  it("normalizes iterations, changes, status checks, and policies", () => {
    expect(
      parsePullRequestIterationList({
        value: [
          {
            author: { displayName: "Ada Lovelace" },
            commonRefCommit: { commitId: "base" },
            id: 3,
            reason: "push",
            sourceRefCommit: { commitId: "source" },
            targetRefCommit: { commitId: "target" },
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        commonRefCommitId: "base",
        id: 3,
        sourceRefCommitId: "source",
        targetRefCommitId: "target",
      }),
    ]);
    expect(
      parsePullRequestChangeList({
        changeEntries: [
          {
            changeId: 2,
            changeTrackingId: 19,
            changeType: "edit",
            item: {
              objectId: "new-object",
              originalObjectId: "old-object",
              path: "/src/app.ts",
            },
          },
        ],
        nextSkip: 25,
      }),
    ).toEqual({
      items: [
        expect.objectContaining({
          changeTrackingId: 19,
          path: "/src/app.ts",
        }),
      ],
      nextSkip: 25,
      nextTop: null,
    });
    expect(
      parsePullRequestStatusList({
        value: [
          {
            context: { genre: "continuous-integration", name: "build" },
            id: 4,
            state: "succeeded",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        context: { genre: "continuous-integration", name: "build" },
        state: "succeeded",
      }),
    ]);
    expect(
      parsePolicyEvaluationList({
        value: [
          {
            configuration: {
              isBlocking: true,
              type: { displayName: "Minimum number of reviewers" },
            },
            evaluationId: "policy-id",
            status: "approved",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        blocking: true,
        evaluationId: "policy-id",
        status: "approved",
        type: "Minimum number of reviewers",
      }),
    ]);
  });

  it("drops malformed code-search results at the external boundary", () => {
    expect(
      parseSearchResults({
        count: 2,
        infoCode: 0,
        results: [
          {
            fileName: "index.ts",
            matches: {
              content: [
                {
                  charOffset: 12,
                  length: 5,
                },
              ],
              fileName: [
                {
                  charOffset: 0,
                  length: -1,
                },
              ],
            },
            path: "/src/index.ts",
            project: {
              id: "project",
              name: "Platform",
            },
            repository: {
              id: "repo",
              name: "App",
            },
            versions: [
              {
                branchName: "main",
                changeId: "abc123",
              },
            ],
          },
          {
            path: "/missing-identity.ts",
          },
        ],
      }),
    ).toEqual({
      infoCode: 0,
      items: [
        expect.objectContaining({
          branch: "main",
          changeId: "abc123",
          fileName: "index.ts",
          matches: [
            {
              charOffset: 12,
              field: "content",
              length: 5,
            },
            {
              charOffset: 0,
              field: "fileName",
              length: -1,
            },
          ],
          path: "/src/index.ts",
        }),
      ],
      rawItemCount: 2,
      totalCount: 2,
    });
  });

  it("normalizes push actors, ref updates, commits, and web links", () => {
    expect(
      parsePushList({
        value: [
          {
            _links: {
              web: {
                href: "https://dev.azure.com/example/project/_git/repo/pushes/7",
              },
            },
            commits: [
              {
                comment: "Ship repository activity",
                commitId: "abc123",
              },
            ],
            date: "2026-07-25T00:00:00Z",
            pushedBy: {
              displayName: "Ada",
              imageUrl: "https://example.com/ada.png",
            },
            pushId: 7,
            refUpdates: [
              {
                name: "refs/heads/main",
                newObjectId: "abc123",
                oldObjectId: "def456",
              },
            ],
          },
          {
            date: "missing id",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        commits: [
          expect.objectContaining({
            commitId: "abc123",
          }),
        ],
        pushId: 7,
        pushedBy: {
          displayName: "Ada",
          imageUrl: "https://example.com/ada.png",
        },
        refUpdates: [
          {
            name: "refs/heads/main",
            newObjectId: "abc123",
            oldObjectId: "def456",
          },
        ],
        webUrl:
          "https://dev.azure.com/example/project/_git/repo/pushes/7",
      }),
    ]);
  });
});
