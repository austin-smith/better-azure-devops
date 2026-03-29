import {
  getTaskDetails,
  listAssignableUsers,
  listTasks,
  updateTaskAssignee,
} from "@/lib/azure-devops/tasks";

const {
  azureDevOpsRequestMock,
  buildAzureDevOpsAssetProxyPathMock,
  isAzureDevOpsAssetUrlMock,
} = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
  buildAzureDevOpsAssetProxyPathMock: vi.fn(
    (source: string) => `/proxy?src=${source}`,
  ),
  isAzureDevOpsAssetUrlMock: vi.fn((source: string) => source.includes("dev.azure.com")),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsOrganizationName: vi.fn(() => "example"),
}));

vi.mock("@/lib/azure-devops/assets", () => ({
  buildAzureDevOpsAssetProxyPath: buildAzureDevOpsAssetProxyPathMock,
  isAzureDevOpsAssetUrl: isAzureDevOpsAssetUrlMock,
}));

describe("azure-devops task helpers", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
    buildAzureDevOpsAssetProxyPathMock.mockClear();
    isAzureDevOpsAssetUrlMock.mockClear();
  });

  it("returns no assignable users for short queries", async () => {
    await expect(listAssignableUsers("token", "a")).resolves.toEqual([]);
    expect(azureDevOpsRequestMock).not.toHaveBeenCalled();
  });

  it("loads assignable users with the entitlement api and dedupes them", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      items: [
        {
          id: "1",
          user: {
            _links: {
              avatar: {
                href: "https://dev.azure.com/example/avatar/ada",
              },
            },
            descriptor: "aad.ada",
            displayName: "Ada Lovelace",
            mailAddress: "ada@example.com",
          },
        },
        {
          id: "2",
          user: {
            displayName: "Ada Lovelace",
            mailAddress: "ADA@example.com",
          },
        },
        {
          id: "3",
        },
      ],
    });

    await expect(listAssignableUsers("token", "Ada's")).resolves.toEqual([
      {
        avatarUrl: "https://dev.azure.com/example/avatar/ada",
        key: "aad.ada",
        name: "Ada Lovelace",
        secondaryText: "ada@example.com",
        value: "ada@example.com",
      },
    ]);

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/userentitlements?$filter=name%20eq%20'Ada''s'",
      {
        accessToken: "token",
        baseUrl: "https://vsaex.dev.azure.com/example",
      },
    );
  });

  it("builds WIQL filters, batches work item fetches, and preserves requested order", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        workItems: [{ id: 11 }, { id: 10 }],
      })
      .mockResolvedValueOnce({
        value: [
          {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Areas\\Platform",
              "System.AssignedTo": { displayName: "Ada Lovelace" },
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description":
                '<p>Safe html</p><script>alert(1)</script><img src="https://dev.azure.com/example/avatar?id=1" />',
              "System.IterationPath": "Project\\Iterations\\Sprint 1",
              "System.State": "Active",
              "System.Title": "Second",
              "System.WorkItemType": "Feature",
            },
            id: 10,
          },
          {
            fields: {
              "Microsoft.VSTS.Common.Priority": 1,
              "System.AreaPath": "Project\\Areas\\Platform\\API",
              "System.AssignedTo": "Grace Hopper",
              "System.ChangedDate": "2025-01-06T12:00:00.000Z",
              "System.Description": "<p>First</p>",
              "System.IterationPath": "Project\\Iterations\\Sprint 1",
              "System.State": "Blocked",
              "System.Title": "First",
              "System.WorkItemType": "Bug",
            },
            id: 11,
          },
        ],
      });

    const result = await listTasks("token", {
      areaPath: "Project\\Areas\\Platform",
      assignee: "me",
      iterationPath: "Project\\Iterations\\Sprint 1",
      priorities: ["1"],
      query: "",
      states: ["Active", "Blocked"],
      types: ["Bug", "Feature"],
    });

    expect(result.map((task) => task.id)).toEqual([11, 10]);
    expect(result[1]).toMatchObject({
      areaPath: "Project\\Areas\\Platform",
      assignee: "Ada Lovelace",
      descriptionHtml: '<p>Safe html</p><img src="/proxy?src=https://dev.azure.com/example/avatar?id=1" />',
      iterationPath: "Project\\Iterations\\Sprint 1",
      priority: "2",
      type: "Feature",
    });

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      1,
      "/_apis/wit/wiql",
      expect.objectContaining({
        accessToken: "token",
        method: "POST",
      }),
    );
    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/_apis/wit/workitemsbatch",
      expect.objectContaining({
        accessToken: "token",
        method: "POST",
      }),
    );
    expect(
      JSON.parse(String(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body)).query,
    ).toContain("[System.AreaPath] UNDER 'Project\\Platform'");
    expect(
      JSON.parse(String(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body)).query,
    ).toContain("[System.IterationPath] UNDER 'Project\\Sprint 1'");
    expect(String(azureDevOpsRequestMock.mock.calls[1]?.[1]?.body)).toContain(
      '"ids":[11,10]',
    );
  });

  it("loads task details, comments, and linked pull requests", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        _links: {
          html: { href: "https://dev.azure.com/example/workitems/42" },
        },
        fields: {
          "Microsoft.VSTS.Common.Priority": 2,
          "System.AreaPath": "Project\\Areas\\Platform",
          "System.AssignedTo": {
            _links: {
              avatar: {
                href: "https://dev.azure.com/example/avatar/ada",
              },
            },
            displayName: "Ada Lovelace",
          },
          "System.ChangedDate": "2025-01-05T12:00:00.000Z",
          "System.Description": "<p>Hello</p>",
          "System.IterationPath": "Project\\Iterations\\Sprint 1",
          "System.Reason": "Work started",
          "System.State": "Active",
          "System.Tags": "backend; urgent",
          "System.Title": "Investigate issue",
          "System.WorkItemType": "Task",
        },
        id: 42,
        relations: [
          {
            attributes: { name: "Pull Request" },
            url: "vstfs:///Git/PullRequestId/example%2Frepo%2F501",
          },
        ],
        rev: 7,
      })
      .mockResolvedValueOnce({
        comments: [
          {
            commentId: 1,
            createdBy: { displayName: "Grace Hopper" },
            createdDate: "2025-01-05T13:00:00.000Z",
            format: "markdown",
            renderedText:
              '<a data-vss-mention="aad,123">Ada &amp; Team</a>',
            text: "Ping @<123>",
          },
          {
            commentId: 2,
            isDeleted: true,
            text: "deleted",
          },
        ],
      })
      .mockResolvedValueOnce({
        _links: {
          web: { href: "https://dev.azure.com/example/pullrequest/501" },
        },
        createdBy: { displayName: "Grace Hopper" },
        creationDate: "2025-01-05T14:00:00.000Z",
        isDraft: true,
        pullRequestId: 501,
        repository: { name: "platform" },
        sourceRefName: "refs/heads/feature/task",
        status: "active",
        targetRefName: "refs/heads/main",
        title: "Fix task details",
      });

    await expect(getTaskDetails("token", 42)).resolves.toMatchObject({
      comments: [
        expect.objectContaining({
          authorName: "Grace Hopper",
          format: "markdown",
          text: "Ping [Ada & Team](./ado-mention/123)",
        }),
      ],
      linkedPullRequests: [
        expect.objectContaining({
          id: 501,
          isDraft: true,
          repositoryName: "platform",
          sourceBranch: "feature/task",
          targetBranch: "main",
        }),
      ],
      revision: 7,
      tags: ["backend", "urgent"],
      url: "https://dev.azure.com/example/workitems/42",
    });
  });

  it("patches the assignee field using optimistic revision checks", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        fields: {
          "Microsoft.VSTS.Common.Priority": 2,
          "System.AreaPath": "Project\\Area\\Platform",
          "System.AssignedTo": "Unassigned",
          "System.ChangedDate": "2025-01-05T12:00:00.000Z",
          "System.Description": "",
          "System.IterationPath": "Project\\Iteration\\Sprint 1",
          "System.Reason": "Reassigned",
          "System.State": "Active",
          "System.Tags": "",
          "System.Title": "Investigate issue",
          "System.WorkItemType": "Task",
        },
        id: 42,
        rev: 8,
      })
      .mockResolvedValueOnce({ comments: [] });

    const result = await updateTaskAssignee("token", 42, null, 7);

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      1,
      "/_apis/wit/workitems/42",
      expect.objectContaining({
        accessToken: "token",
        contentType: "application/json-patch+json",
        method: "PATCH",
      }),
    );
    expect(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify([
        { op: "test", path: "/rev", value: 7 },
        { op: "add", path: "/fields/System.AssignedTo", value: "" },
      ]),
    );
    expect(result.revision).toBe(8);
    expect(result.assignee).toBe("Unassigned");
  });
});
