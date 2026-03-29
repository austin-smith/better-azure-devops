import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Source_Code_Pro } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/themes/theme-provider";
import { ThemeShortcut } from "@/components/themes/theme-shortcut";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getAzureDevOpsConfig,
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import { loadCurrentAzureDevOpsUser } from "@/lib/azure-devops/current-user";
import {
  PREFERRED_THEME_FAMILY_KEY,
  THEME_MODE_COOKIE_NAME,
  getThemeModeScript,
  isKnownThemeFamily,
  normalizeThemeMode,
} from "@/lib/theme/constants";
import { loadDashboardOverview } from "@/lib/tasks/load-dashboard-overview";

const sourceCodePro = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-perpetuity-dark",
  display: "swap",
});

export const metadata: Metadata = {
  description: "Manage Azure DevOps work items.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const [overview, currentUser] = config
    ? await Promise.all([
        loadDashboardOverview(),
        loadCurrentAzureDevOpsUser(),
      ])
    : [null, null];
  const orgLabel = config
    ? new URL(config.orgUrl).pathname.replace(/^\/|\/$/g, "")
    : "Azure DevOps";
  const projectLabel = config?.project ?? "Work Items";
  const familyCookieRaw =
    cookieStore.get(PREFERRED_THEME_FAMILY_KEY)?.value ?? "";
  const themeModeCookieRaw = cookieStore.get(THEME_MODE_COOKIE_NAME)?.value ?? "";
  const sidebarOpenCookieRaw = cookieStore.get("sidebar_state")?.value;
  const serverThemeMode = normalizeThemeMode(themeModeCookieRaw);
  const defaultSidebarOpen =
    sidebarOpenCookieRaw === "false" ? false : true;
  const serverThemeFamilyClass =
    familyCookieRaw !== "default" && isKnownThemeFamily(familyCookieRaw)
      ? familyCookieRaw
      : "";
  const htmlClassName = [
    "h-full",
    sourceCodePro.variable,
    serverThemeMode === "dark" ? "dark" : "",
    serverThemeFamilyClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en" className={htmlClassName} suppressHydrationWarning>
      <body className="flex min-h-full flex-col antialiased">
        <Script
          id="theme-mode-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeModeScript() }}
        />
        <ThemeProvider
          defaultTheme="system"
          disableTransitionOnChange
          initialTheme={serverThemeMode}
        >
          <ThemeShortcut />
          <TooltipProvider>
            <SidebarProvider defaultOpen={defaultSidebarOpen}>
              <AppSidebar
                currentUser={currentUser}
                orgLabel={orgLabel}
                projectLabel={projectLabel}
                queueCount={overview?.error ? null : (overview?.queueCount ?? null)}
                taskCount={overview?.error ? null : (overview?.openTaskCount ?? null)}
              />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
