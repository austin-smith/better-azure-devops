import type { Metadata } from "next";
import { DashboardOverview } from "@/components/home/dashboard-overview";
import { loadDashboardPullRequests } from "@/lib/repositories/load-dashboard-pull-requests";
import { loadDashboardOverview } from "@/lib/tasks/load-dashboard-overview";

export const metadata: Metadata = {
  title: "Home",
  description: "Work item and pull request overview",
};

export default async function HomePage() {
  const [overview, pullRequests] = await Promise.all([
    loadDashboardOverview(),
    loadDashboardPullRequests(),
  ]);

  return <DashboardOverview overview={overview} pullRequests={pullRequests} />;
}
