import { getAzureDevOpsIdentityLabels } from "@/lib/azure-devops/identities";

const { azureDevOpsRequestMock } = vi.hoisted(() => ({
  azureDevOpsRequestMock: vi.fn(),
}));

vi.mock("@/lib/azure-devops/client", () => ({
  azureDevOpsRequest: azureDevOpsRequestMock,
}));

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: () => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  }),
  getAzureDevOpsOrganizationName: () => "example organization",
}));

describe("Azure DevOps identities", () => {
  beforeEach(() => {
    azureDevOpsRequestMock.mockReset();
  });

  it("batches normalized identity IDs and uses provider display names", async () => {
    azureDevOpsRequestMock.mockResolvedValue({
      value: [
        {
          id: "ADA-ID",
          providerDisplayName: "Ada Lovelace",
        },
      ],
    });

    await expect(
      getAzureDevOpsIdentityLabels("token", [
        "ADA-ID",
        "ada-id",
        " ",
      ]),
    ).resolves.toEqual(new Map([["ada-id", "Ada Lovelace"]]));

    expect(azureDevOpsRequestMock).toHaveBeenCalledWith(
      "/_apis/identities?api-version=7.1-preview.1&identityIds=ada-id&queryMembership=None",
      expect.objectContaining({
        accessToken: "token",
        baseUrl:
          "https://vssps.dev.azure.com/example%20organization",
        cache: "force-cache",
      }),
    );
  });
});
