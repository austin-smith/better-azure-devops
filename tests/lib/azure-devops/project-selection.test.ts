const {
  getLegacyAzureDevOpsProjectMock,
  listProjectsMock,
  readAppSettingMock,
  writeAppSettingMock,
} = vi.hoisted(() => ({
  getLegacyAzureDevOpsProjectMock: vi.fn(),
  listProjectsMock: vi.fn(),
  readAppSettingMock: vi.fn(),
  writeAppSettingMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getLegacyAzureDevOpsProject: getLegacyAzureDevOpsProjectMock,
}));

vi.mock("@/lib/azure-devops/projects", () => ({
  listProjects: listProjectsMock,
}));

vi.mock("@/db/repositories/app-settings", () => ({
  readAppSetting: readAppSettingMock,
  writeAppSetting: writeAppSettingMock,
}));

describe("azure-devops project selection", () => {
  beforeEach(() => {
    listProjectsMock.mockReset();
    getLegacyAzureDevOpsProjectMock.mockReset();
    readAppSettingMock.mockReset();
    writeAppSettingMock.mockReset();
    getLegacyAzureDevOpsProjectMock.mockReturnValue(null);
    readAppSettingMock.mockReturnValue(
      JSON.stringify({ projectIds: ["saved-project-id"] }),
    );
  });

  it("does not fall back to saved projects when an explicit project id is missing", async () => {
    listProjectsMock.mockResolvedValue([
      {
        defaultTeamImageUrl: null,
        id: "saved-project-id",
        name: "Saved Project",
        state: "wellFormed",
        url: "https://dev.azure.com/example/_apis/projects/saved-project-id",
      },
    ]);

    const { loadAzureDevOpsProjectSelection } = await import(
      "@/lib/azure-devops/project-selection"
    );

    await expect(
      loadAzureDevOpsProjectSelection("token", ["missing-project-id"]),
    ).resolves.toEqual({
      availableProjects: [
        {
          defaultTeamImageUrl: null,
          id: "saved-project-id",
          name: "Saved Project",
          state: "wellFormed",
          url: "https://dev.azure.com/example/_apis/projects/saved-project-id",
        },
      ],
      selectedProjectIds: ["missing-project-id"],
      selectedProjects: [],
      source: "url",
    });
    expect(writeAppSettingMock).not.toHaveBeenCalled();
  });
});
