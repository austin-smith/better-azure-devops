import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { updateAnalyticsSettings } from "@/app/settings/actions";
import { INITIAL_ANALYTICS_SETTINGS_ACTION_STATE } from "@/lib/analytics/settings-action-state";

const { requestRepositoryCatalogRefreshMock, revalidatePathMock } = vi.hoisted(
  () => ({
    requestRepositoryCatalogRefreshMock: vi.fn(),
    revalidatePathMock: vi.fn(),
  }),
);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));
vi.mock("@/lib/analytics/scheduler", () => ({
  requestRepositoryCatalogRefresh: requestRepositoryCatalogRefreshMock,
}));

function createSettingsFormData(enabled: boolean) {
  const formData = new FormData();

  if (enabled) {
    formData.set("enabled", "on");
  }

  formData.set("historyWindowDays", "30");
  formData.set("refreshIntervalHours", "6");

  return formData;
}

describe("analytics settings action", () => {
  beforeEach(() => {
    process.env.LOCAL_SETTINGS_DATABASE_PATH = path.join(
      tmpdir(),
      `better-ado-settings-action-${randomUUID()}.sqlite`,
    );
    vi.clearAllMocks();
  });

  it("requests repository discovery when analytics is enabled", async () => {
    await updateAnalyticsSettings(
      INITIAL_ANALYTICS_SETTINGS_ACTION_STATE,
      createSettingsFormData(true),
    );

    expect(requestRepositoryCatalogRefreshMock).toHaveBeenCalledOnce();
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
  });

  it("does not request repository discovery when enabled settings are edited", async () => {
    await updateAnalyticsSettings(
      INITIAL_ANALYTICS_SETTINGS_ACTION_STATE,
      createSettingsFormData(true),
    );
    requestRepositoryCatalogRefreshMock.mockClear();

    await updateAnalyticsSettings(
      INITIAL_ANALYTICS_SETTINGS_ACTION_STATE,
      createSettingsFormData(true),
    );

    expect(requestRepositoryCatalogRefreshMock).not.toHaveBeenCalled();
  });
});
