import { GET } from "@/app/api/health/route";

const { getLocalSettingsDbMock, runMock } = vi.hoisted(() => ({
  getLocalSettingsDbMock: vi.fn(),
  runMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  getLocalSettingsDb: getLocalSettingsDbMock,
}));

describe("health route", () => {
  beforeEach(() => {
    getLocalSettingsDbMock.mockReset();
    runMock.mockReset();
    getLocalSettingsDbMock.mockReturnValue({
      run: runMock,
    });
  });

  it("reports healthy after checking the database", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "ok",
    });
    expect(runMock).toHaveBeenCalledOnce();
  });

  it("reports unhealthy without exposing the failure", async () => {
    const error = new Error("database unavailable");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    getLocalSettingsDbMock.mockImplementation(() => {
      throw error;
    });

    const response = GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      status: "error",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith("Health check failed.", error);
  });
});
