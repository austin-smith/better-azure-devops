const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();

  return {
    ...react,
    cache: <Arguments extends readonly unknown[], Result>(
      callback: (...args: Arguments) => Result,
    ) => {
      const results = new Map<string, Result>();

      return (...args: Arguments) => {
        const key = JSON.stringify(args);

        if (!results.has(key)) {
          results.set(key, callback(...args));
        }

        return results.get(key) as Result;
      };
    },
  };
});

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
  getAzureDevOpsOrganizationName: vi.fn(() => "example"),
}));

vi.mock("@/lib/azure-devops/assets", () => ({
  buildAzureDevOpsAssetProxyPath: vi.fn((source: string) => source),
  isAzureDevOpsAssetUrl: vi.fn(() => false),
}));

describe("task WIQL request cache", () => {
  it("shares an equivalent ID query between count and record loaders", async () => {
    azureDevOpsRequestMock
      .mockResolvedValueOnce({
        workItems: [{ id: 11 }],
      })
      .mockResolvedValueOnce({
        value: [
          {
            fields: {
              "System.ChangedDate": "2025-01-06T12:00:00.000Z",
              "System.State": "Active",
              "System.TeamProject": "Project",
              "System.Title": "First",
              "System.WorkItemType": "Task",
            },
            id: 11,
          },
        ],
      });
    const { countTasks, listTasks } = await import(
      "@/lib/azure-devops/tasks"
    );
    const projects = [
      {
        defaultTeamImageUrl: null,
        id: "project-id",
        name: "Project",
      },
    ];

    await expect(countTasks("token", projects)).resolves.toBe(1);
    await expect(listTasks("token", [...projects])).resolves.toHaveLength(1);

    expect(
      azureDevOpsRequestMock.mock.calls.filter(
        ([path]) => path === "/_apis/wit/wiql",
      ),
    ).toHaveLength(1);
    expect(azureDevOpsRequestMock).toHaveBeenCalledTimes(2);
  });
});
