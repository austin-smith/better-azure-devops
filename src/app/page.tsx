import type { Metadata } from "next";
import { DashboardOverview } from "@/components/home/dashboard-overview";
import { loadDashboardOverview } from "@/lib/tasks/load-dashboard-overview";

export const metadata: Metadata = {
  title: "Home",
  description: "Work item overview",
};

export default async function HomePage() {
  const overview = await loadDashboardOverview();

  return <DashboardOverview overview={overview} />;
}
