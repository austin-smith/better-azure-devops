import {
  createTask,
  getTaskEditMetadata,
  getTaskDetails,
  getTeamAreaSettings,
  listAreaPathOptions,
  listAssignableUsers,
  listTasks,
  updateTask,
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
              "System.TeamProject": "Project",
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
              "System.TeamProject": "Project",
              "System.Title": "First",
              "System.WorkItemType": "Bug",
            },
            id: 11,
          },
        ],
      });

    const result = await listTasks("token", [{
      defaultTeamImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
      id: "project-id",
      name: "Project",
    }], {
      areaPath: "Project\\Platform",
      assignee: "me",
      iterationPath: "Project\\Sprint 1",
      priorities: ["1"],
      query: "",
      states: ["Active", "Blocked"],
      types: ["Bug", "Feature"],
    });

    expect(result.map((task) => task.id)).toEqual([11, 10]);
    expect(result[1]).toMatchObject({
      areaPath: "Project\\Areas\\Platform",
      assignee: "Ada Lovelace",
      iterationPath: "Project\\Iterations\\Sprint 1",
      priority: "2",
      projectImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
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
    expect(String(azureDevOpsRequestMock.mock.calls[1]?.[1]?.body)).not.toContain(
      "System.Description",
    );
  });

  it("does not send a bare project root as an area path filter", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        workItems: [{ id: 10 }],
      })
      .mockResolvedValueOnce({
        value: [
          {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Areas\\Platform",
              "System.AssignedTo": { displayName: "Ada Lovelace" },
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description": "<p>Safe html</p>",
              "System.IterationPath": "Project\\Iterations\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "Second",
              "System.WorkItemType": "Feature",
            },
            id: 10,
          },
        ],
      });

    await listTasks("token", [{
      defaultTeamImageUrl: null,
      id: "project-id",
      name: "Project",
    }], {
      areaPath: "Project",
      assignee: null,
      iterationPath: null,
      priorities: [],
      query: "",
      states: [],
      types: [],
    });

    expect(
      JSON.parse(String(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body)).query,
    ).not.toContain("[System.AreaPath] UNDER");
  });

  it("does not send malformed single-segment area path filters", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        workItems: [{ id: 10 }],
      })
      .mockResolvedValueOnce({
        value: [
          {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Areas\\Platform",
              "System.AssignedTo": { displayName: "Ada Lovelace" },
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description": "<p>Safe html</p>",
              "System.IterationPath": "Project\\Iterations\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "Second",
              "System.WorkItemType": "Feature",
            },
            id: 10,
          },
        ],
      });

    await listTasks("token", [{
      defaultTeamImageUrl: null,
      id: "project-id",
      name: "Project",
    }], {
      areaPath: "Platform",
      assignee: null,
      iterationPath: null,
      priorities: [],
      query: "",
      states: [],
      types: [],
    });

    expect(
      JSON.parse(String(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body)).query,
    ).not.toContain("[System.AreaPath] UNDER");
  });

  it("omits classification root options that normalize to the bare project path", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      children: [
        {
          name: "Areas",
          path: "Project\\Areas",
          children: [
            {
              name: "Platform",
              path: "Project\\Areas\\Platform",
            },
          ],
        },
      ],
      name: "Project",
      path: "Project",
    });

    await expect(listAreaPathOptions("token", [{
      defaultTeamImageUrl: null,
      id: "project-id",
      name: "Project",
    }])).resolves.toEqual([
      expect.objectContaining({
        name: "Platform",
        value: "Project\\Platform",
      }),
    ]);
  });

  it("loads task details, comments, and linked pull requests", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/42?$expand=relations":
          return {
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
              "System.TeamProject": "Project",
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
          };
        case "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4":
          return {
            comments: [
              {
                commentId: 1,
                createdBy: { displayName: "Grace Hopper" },
                createdDate: "2025-01-05T13:00:00.000Z",
                format: "markdown",
                reactions: [
                  {
                    count: 2,
                    isCurrentUserEngaged: true,
                    type: "heart",
                  },
                  {
                    count: 1,
                    isCurrentUserEngaged: false,
                    type: "like",
                  },
                  {
                    count: 0,
                    type: "smile",
                  },
                ],
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
          };
        case "/_apis/wit/workItems/42/comments/1/reactions/like/users?$top=1&api-version=7.1-preview.1":
          return {
            count: 1,
            value: [
              {
                displayName: "Ada Lovelace",
              },
            ],
          };
        case "/_apis/wit/workItems/42/comments/1/reactions/heart/users?$top=2&api-version=7.1-preview.1":
          return {
            count: 2,
            value: [
              {
                displayName: "Grace Hopper",
              },
              {
                displayName: "Barbara Liskov",
              },
            ],
          };
        case "/_apis/git/pullrequests/501":
          return {
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
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    await expect(getTaskDetails("token", 42)).resolves.toMatchObject({
      comments: [
        expect.objectContaining({
          authorName: "Grace Hopper",
          format: "markdown",
          reactions: [
            {
              count: 1,
              isCurrentUserEngaged: false,
              type: "like",
              users: [{ avatarUrl: null, name: "Ada Lovelace" }],
            },
            {
              count: 2,
              isCurrentUserEngaged: true,
              type: "heart",
              users: [
                { avatarUrl: null, name: "Grace Hopper" },
                { avatarUrl: null, name: "Barbara Liskov" },
              ],
            },
          ],
          content: "Ping [Ada & Team](./ado-mention/123)",
        }),
      ],
      description: {
        content: "<p>Hello</p>",
        format: "unknown",
      },
      linkedPullRequests: [
        expect.objectContaining({
          id: 501,
          isDraft: true,
          repositoryName: "platform",
          sourceBranch: "feature/task",
          targetBranch: "main",
        }),
      ],
      projectImageUrl: null,
      revision: 7,
      tags: ["backend", "urgent"],
      url: "https://dev.azure.com/example/workitems/42",
    });

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4",
      {
        accessToken: "token",
        projectName: "Project",
      },
    );

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/wit/workItems/42/comments/1/reactions/like/users?$top=1&api-version=7.1-preview.1",
      {
        accessToken: "token",
        projectName: "Project",
      },
    );

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/wit/workItems/42/comments/1/reactions/heart/users?$top=2&api-version=7.1-preview.1",
      {
        accessToken: "token",
        projectName: "Project",
      },
    );

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/git/pullrequests/501",
      { accessToken: "token" },
    );
  });

  it("uses Azure DevOps multiline field format for task descriptions", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/42?$expand=relations":
          return {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Area",
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description": "# Heading\n\n- **Done**",
              "System.IterationPath": "Project\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "Markdown task",
              "System.WorkItemType": "Task",
            },
            id: 42,
            multilineFieldsFormat: {
              "System.Description": "markdown",
            },
            rev: 3,
          };
        case "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4":
          return {
            comments: [],
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    await expect(getTaskDetails("token", 42)).resolves.toMatchObject({
      description: {
        content: "# Heading\n\n- **Done**",
        format: "markdown",
      },
    });
  });

  it("preserves HTML task checkboxes as inert description markup", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/42?$expand=relations":
          return {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Area",
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description": [
                "<ul>",
                '<li><input type="checkbox" checked onclick="alert(1)"> Done</li>',
                '<li><input type="checkbox"> Todo</li>',
                '<li><input type="text" value="Unsafe"></li>',
                "</ul>",
              ].join(""),
              "System.IterationPath": "Project\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "HTML checklist task",
              "System.WorkItemType": "Task",
            },
            id: 42,
            multilineFieldsFormat: {
              "System.Description": "html",
            },
            rev: 3,
          };
        case "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4":
          return {
            comments: [],
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    const result = await getTaskDetails("token", 42);

    expect(result.description.format).toBe("html");
    expect(result.description.content).toContain('type="checkbox"');
    expect(result.description.content).toContain('checked="checked"');
    expect(result.description.content).toContain('disabled="disabled"');
    expect(result.description.content).not.toContain("onclick");
    expect(result.description.content).not.toContain('type="text"');
  });

  it("renders sanitized Azure DevOps mentions as non-link HTML markup", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/42?$expand=relations":
          return {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Area",
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description":
                '<p>Ping <a data-vss-mention="aad,123" href="https://example.com/profile" target="_blank">Ada Lovelace</a></p>',
              "System.IterationPath": "Project\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "HTML mention task",
              "System.WorkItemType": "Task",
            },
            id: 42,
            multilineFieldsFormat: {
              "System.Description": "html",
            },
            rev: 3,
          };
        case "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4":
          return {
            comments: [],
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    const result = await getTaskDetails("token", 42);

    expect(result.description.content).toContain(
      '<span data-vss-mention="aad,123">Ada Lovelace</span>',
    );
    expect(result.description.content).not.toContain("<a");
    expect(result.description.content).not.toContain("href=");
    expect(result.description.content).not.toContain("target=");
  });

  it("adds lazy async loading hints to sanitized HTML description images", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/42?$expand=relations":
          return {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Area",
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description":
                '<p><img alt="Diagram" src="https://example.com/diagram.png"></p>',
              "System.IterationPath": "Project\\Sprint 1",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "HTML image task",
              "System.WorkItemType": "Task",
            },
            id: 42,
            multilineFieldsFormat: {
              "System.Description": "html",
            },
            rev: 3,
          };
        case "/_apis/wit/workItems/42/comments?$top=20&order=desc&$expand=all&api-version=7.1-preview.4":
          return {
            comments: [],
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    const result = await getTaskDetails("token", 42);

    expect(result.description.content).toContain('loading="lazy"');
    expect(result.description.content).toContain('decoding="async"');
  });

  it("uses the task context project image when loading task details", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      fields: {
        "System.AreaPath": "Project\\Areas\\Platform",
        "System.ChangedDate": "2025-01-05T12:00:00.000Z",
        "System.IterationPath": "Project\\Iterations\\Sprint 1",
        "System.State": "Active",
        "System.Title": "Investigate issue",
        "System.WorkItemType": "Task",
      },
      id: 42,
      rev: 7,
    });

    await expect(
      getTaskDetails("token", 42, {
        projectId: "project-id",
        projectImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
        projectName: "Project",
      }),
    ).resolves.toMatchObject({
      projectId: "project-id",
      projectImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
      projectName: "Project",
    });
  });

  it("loads task edit metadata from the work item type field definition", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        fields: {
          "System.TeamProject": "Project",
          "System.WorkItemType": "Task",
        },
      })
      .mockResolvedValueOnce({
        allowedValues: [1, 2, 3, 2],
      });

    await expect(getTaskEditMetadata("token", 42)).resolves.toEqual({
      priorities: ["1", "2", "3"],
    });

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      2,
      "/_apis/wit/workitemtypes/Task/fields/Microsoft.VSTS.Common.Priority?$expand=allowedValues",
      {
        accessToken: "token",
        projectName: "Project",
      },
    );
  });

  it("loads team area defaults from team field values", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      defaultValue: "Project\\Platform",
      field: {
        referenceName: "System.AreaPath",
      },
      values: [
        {
          includeChildren: true,
          value: "Project\\Platform",
        },
        {
          includeChildren: false,
          value: " Project\\Support ",
        },
        {
          includeChildren: false,
          value: "Project\\Platform",
        },
      ],
    });

    await expect(
      getTeamAreaSettings("token", {
        defaultTeamImageUrl: null,
        id: "project-id",
        name: "Project",
      }),
    ).resolves.toEqual({
      areas: [
        {
          includeChildren: true,
          value: "Project\\Platform",
        },
        {
          includeChildren: false,
          value: "Project\\Support",
        },
      ],
      defaultAreaPath: "Project\\Platform",
    });

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/work/teamsettings/teamfieldvalues",
      {
        accessToken: "token",
        projectName: "Project",
      },
    );
  });

  it("creates work items with Azure DevOps JSON Patch fields", async () => {
    azureDevOpsRequestMock.mockImplementation(async (path: string) => {
      switch (path) {
        case "/_apis/wit/workitems/%24User%20Story?$expand=relations":
          return {
            fields: {
              "Microsoft.VSTS.Common.Priority": 2,
              "System.AreaPath": "Project\\Area",
              "System.ChangedDate": "2025-01-05T12:00:00.000Z",
              "System.Description": "<p>Hello</p>",
              "System.IterationPath": "Project\\Sprint 1",
              "System.State": "New",
              "System.TeamProject": "Project",
              "System.Title": "Created story",
              "System.WorkItemType": "User Story",
            },
            id: 99,
            rev: 1,
          };
        default:
          throw new Error(`Unexpected path: ${path}`);
      }
    });

    await expect(
      createTask(
        "token",
        {
          areaPath: "Project\\Area",
          description: "# Heading\n\nDetails",
          priority: "2",
          projectName: "Project",
          title: "Created story",
          type: "User Story",
        },
        {
          projectId: "project-id",
          projectImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
          projectName: "Project",
        },
      ),
    ).resolves.toMatchObject({
      id: 99,
      projectId: "project-id",
      projectImageUrl: "https://dev.azure.com/example/_apis/projects/project-id/image",
      title: "Created story",
      type: "User Story",
    });

    expect(azureDevOpsRequestMock).toHaveBeenNthCalledWith(
      1,
      "/_apis/wit/workitems/%24User%20Story?$expand=relations",
      expect.objectContaining({
        accessToken: "token",
        contentType: "application/json-patch+json",
        method: "POST",
        projectName: "Project",
      }),
    );
    expect(azureDevOpsRequestMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body))).toEqual([
      {
        op: "add",
        path: "/fields/System.Title",
        value: "Created story",
      },
      {
        op: "add",
        path: "/fields/System.AreaPath",
        value: "Project\\Area",
      },
      {
        op: "add",
        path: "/fields/System.Description",
        value: "# Heading\n\nDetails",
      },
      {
        op: "add",
        path: "/multilineFieldsFormat/System.Description",
        value: "Markdown",
      },
      {
        op: "add",
        path: "/fields/Microsoft.VSTS.Common.Priority",
        value: 2,
      },
    ]);
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

  it("patches multiple task fields using optimistic revision checks", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        fields: {
          "Microsoft.VSTS.Common.Priority": 1,
          "System.AreaPath": "Project\\Area\\Platform",
          "System.AssignedTo": {
            displayName: "Ada Lovelace",
            uniqueName: "ada@example.com",
          },
          "System.ChangedDate": "2025-01-05T12:00:00.000Z",
          "System.Description": "",
          "System.IterationPath": "Project\\Iteration\\Sprint 2",
          "System.Reason": "Updated",
          "System.State": "Active",
          "System.Tags": "",
          "System.Title": "Updated title",
          "System.WorkItemType": "Task",
        },
        id: 42,
        rev: 8,
      })
      .mockResolvedValueOnce({ comments: [] });

    const result = await updateTask(
      "token",
      42,
      {
        areaPath: "Project\\Area\\Platform",
        assignee: "ada@example.com",
        description: "## Updated description",
        iterationPath: "Project\\Iteration\\Sprint 2",
        priority: "1",
        title: "Updated title",
      },
      7,
    );

    expect(azureDevOpsRequestMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify([
        { op: "test", path: "/rev", value: 7 },
        { op: "add", path: "/fields/System.Title", value: "Updated title" },
        { op: "add", path: "/fields/System.AssignedTo", value: "ada@example.com" },
        { op: "add", path: "/fields/System.Description", value: "## Updated description" },
        { op: "add", path: "/multilineFieldsFormat/System.Description", value: "Markdown" },
        { op: "add", path: "/fields/Microsoft.VSTS.Common.Priority", value: 1 },
        { op: "add", path: "/fields/System.AreaPath", value: "Project\\Area\\Platform" },
        { op: "add", path: "/fields/System.IterationPath", value: "Project\\Iteration\\Sprint 2" },
      ]),
    );
    expect(result).toMatchObject({
      areaPath: "Project\\Area\\Platform",
      assignee: "Ada Lovelace",
      assigneeValue: "ada@example.com",
      iterationPath: "Project\\Iteration\\Sprint 2",
      priority: "1",
      revision: 8,
      title: "Updated title",
    });
  });
});
