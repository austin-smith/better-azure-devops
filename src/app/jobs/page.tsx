import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { JobHistory } from "@/components/jobs/job-history";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { loadJobHistory } from "@/lib/job-history";
import { parseJobHistorySearchParams } from "@/lib/job-history/filters";
import type { JobHistorySearchParams } from "@/lib/job-history/types";

export const metadata: Metadata = {
  description: "Monitor background jobs and recent job history",
  title: "Jobs",
};

type JobsPageProps = {
  searchParams: Promise<JobHistorySearchParams>;
};

export default async function JobsPage({
  searchParams,
}: JobsPageProps) {
  const filters = parseJobHistorySearchParams(await searchParams);
  const history = loadJobHistory(filters);

  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Jobs" }]}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-semibold">Jobs</h1>
          <span className="text-xs text-muted-foreground">
            30-day history
          </span>
        </div>
        <JobHistory
          generatedAt={new Date().toISOString()}
          history={history}
        />
      </main>
    </>
  );
}
