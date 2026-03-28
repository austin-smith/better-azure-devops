import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeShortcut } from "@/components/theme-shortcut";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  getAzureDevOpsConfig,
  hasAzureDevOpsConfig,
} from "@/lib/azure-devops/config";
import { listTaskViews } from "@/lib/tasks/views";

export const metadata: Metadata = {
  description: "Task workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const config = hasAzureDevOpsConfig() ? getAzureDevOpsConfig() : null;
  const orgLabel = config
    ? new URL(config.orgUrl).pathname.replace(/^\/|\/$/g, "")
    : "Azure DevOps";
  const projectLabel = config?.project ?? "Tasks";

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="flex min-h-full flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeShortcut />
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar
                orgLabel={orgLabel}
                projectLabel={projectLabel}
                views={listTaskViews()}
              />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
