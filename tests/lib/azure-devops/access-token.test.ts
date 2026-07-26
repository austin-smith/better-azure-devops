import { execFile } from "node:child_process";
import path from "node:path";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("getAzureDevOpsAccessToken", () => {
  const execFileMock = vi.mocked(execFile);
  const originalEnv = process.env;
  const originalPlatform = process.platform;
  const azureConfigDir = path.join(process.cwd(), ".azure");

  function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, "platform", {
      configurable: true,
      value: platform,
    });
  }

  function mockExecFileSuccess(payload: object) {
    execFileMock.mockImplementation(
      ((file, args, options, callback) => {
        callback?.(null, JSON.stringify(payload), "");
        return {} as never;
      }) as typeof execFile,
    );
  }

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    setPlatform(originalPlatform);
    execFileMock.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
    setPlatform(originalPlatform);
  });

  it("invokes Azure CLI directly outside Windows with the repo-local config dir", async () => {
    setPlatform("linux");
    mockExecFileSuccess({
      accessToken: "token",
      expires_on: Math.floor(Date.now() / 1000) + 3600,
    });

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).resolves.toBe("token");
    expect(execFileMock).toHaveBeenCalledWith(
      "az",
      [
        "account",
        "get-access-token",
        "--resource",
        "499b84ac-1321-427f-aa17-267ca6975798",
        "-o",
        "json",
      ],
      {
        env: expect.objectContaining({
          AZURE_CONFIG_DIR: azureConfigDir,
        }),
      },
      expect.any(Function),
    );
  });

  it("honors an explicit Azure CLI config directory", async () => {
    setPlatform("linux");
    process.env.AZURE_CONFIG_DIR = "/tmp/custom-azure-config";
    mockExecFileSuccess({
      accessToken: "token",
      expires_on: Math.floor(Date.now() / 1000) + 3600,
    });

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).resolves.toBe("token");
    expect(execFileMock).toHaveBeenCalledWith(
      "az",
      expect.any(Array),
      {
        env: expect.objectContaining({
          AZURE_CONFIG_DIR: "/tmp/custom-azure-config",
        }),
      },
      expect.any(Function),
    );
  });

  it("invokes Azure CLI through cmd.exe from a trusted Windows cwd", async () => {
    setPlatform("win32");
    process.env.ComSpec = "C:\\Windows\\System32\\cmd.exe";
    mockExecFileSuccess({
      accessToken: "token",
      expires_on: Math.floor(Date.now() / 1000) + 3600,
    });

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).resolves.toBe("token");
    expect(execFileMock).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "az account get-access-token --resource 499b84ac-1321-427f-aa17-267ca6975798 -o json",
      ],
      {
        cwd: "C:\\Windows\\System32",
        env: expect.objectContaining({
          AZURE_CONFIG_DIR: azureConfigDir,
        }),
      },
      expect.any(Function),
    );
  });

  it("reuses cached tokens when expiresOn parsing succeeds", async () => {
    setPlatform("linux");
    mockExecFileSuccess({
      accessToken: "cached-token",
      expiresOn: "2099-01-01T00:00:00.000Z",
    });

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).resolves.toBe("cached-token");
    await expect(getAzureDevOpsAccessToken()).resolves.toBe("cached-token");
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight Azure CLI request", async () => {
    setPlatform("linux");
    let completeRequest:
      | ((error: null, stdout: string, stderr: string) => void)
      | undefined;
    execFileMock.mockImplementation(
      ((file, args, options, callback) => {
        completeRequest = callback as typeof completeRequest;
        return {} as never;
      }) as typeof execFile,
    );

    const { getAzureDevOpsAccessToken } = await import(
      "@/lib/azure-devops/access-token"
    );
    const firstRequest = getAzureDevOpsAccessToken();
    const secondRequest = getAzureDevOpsAccessToken();

    expect(execFileMock).toHaveBeenCalledOnce();

    completeRequest?.(
      null,
      JSON.stringify({
        accessToken: "shared-token",
        expires_on: Math.floor(Date.now() / 1000) + 3600,
      }),
      "",
    );

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      "shared-token",
      "shared-token",
    ]);
  });

  it("reports when Azure CLI is unavailable on Windows", async () => {
    setPlatform("win32");
    process.env.ComSpec = "C:\\Windows\\System32\\cmd.exe";
    execFileMock.mockImplementation(
      ((file, args, options, callback) => {
        callback?.(new Error("'az' is not recognized as an internal or external command"), "", "");
        return {} as never;
      }) as typeof execFile,
    );

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).rejects.toMatchObject({
      code: "azure_cli_not_installed",
      message:
        "Azure CLI is not installed. Install it, then run `az login` with `AZURE_CONFIG_DIR` set to `.azure`.",
    });
    expect(execFileMock).toHaveBeenCalledOnce();
  });

  it("does not report malformed Azure CLI output as expired authentication", async () => {
    setPlatform("linux");
    execFileMock.mockImplementation(
      ((file, args, options, callback) => {
        callback?.(null, "not json", "");
        return {} as never;
      }) as typeof execFile,
    );

    const { getAzureDevOpsAccessToken } = await import("@/lib/azure-devops/access-token");

    await expect(getAzureDevOpsAccessToken()).rejects.toMatchObject({
      code: "unknown",
    });
  });
});
