import { getAzureDevOpsMetadataCacheTags } from "@/lib/azure-devops/cache-scope";

vi.mock("@/lib/azure-devops/config", () => ({
  getAzureDevOpsConfig: vi.fn(() => ({
    apiVersion: "7.1",
    orgUrl: "https://dev.azure.com/example",
  })),
}));

function createAccessToken(claims: object) {
  return [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify(claims)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("Azure DevOps metadata cache scope", () => {
  it("isolates tags by user, resource, and project without including the token", () => {
    const firstToken = createAccessToken({ oid: "user-1", tid: "tenant" });
    const secondToken = createAccessToken({ oid: "user-2", tid: "tenant" });
    const firstTags = getAzureDevOpsMetadataCacheTags(
      firstToken,
      "classification-areas",
      "project-1",
    );
    const secondTags = getAzureDevOpsMetadataCacheTags(
      secondToken,
      "classification-areas",
      "project-1",
    );
    const otherProjectTags = getAzureDevOpsMetadataCacheTags(
      firstToken,
      "classification-areas",
      "project-2",
    );

    expect(firstTags).not.toEqual(secondTags);
    expect(firstTags).not.toEqual(otherProjectTags);
    expect(firstTags.join(":")).not.toContain(firstToken);
  });
});
