import type { Metadata } from "next";
import { connection } from "next/server";
import { updateAnalyticsSettings } from "@/app/settings/actions";
import { AppHeader } from "@/components/app-header";
import { AnalyticsSettingsForm } from "@/components/settings/analytics-settings-form";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { loadAnalyticsSettings } from "@/lib/analytics/settings";

export const metadata: Metadata = {
  description: "Configure Better ADO",
  title: "Settings",
};

export default async function SettingsPage() {
  await connection();
  const settings = loadAnalyticsSettings();

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Settings" }]}
      />
      <main className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
        <div className="w-full max-w-2xl space-y-5">
          <div>
            <h1 className="text-lg font-semibold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure application behavior.
            </p>
          </div>
          <Separator />
          <AnalyticsSettingsForm
            action={updateAnalyticsSettings}
            settings={settings}
          />
        </div>
      </main>
    </>
  );
}
