import { NextResponse } from "next/server";
import { getRepositoryAnalyticsJobById } from "@/lib/analytics/refresh";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      jobId: string;
      projectId: string;
      repositoryId: string;
    }>;
  },
) {
  const { jobId, repositoryId } = await context.params;
  const job = getRepositoryAnalyticsJobById(jobId);

  if (!job || job.resourceId !== repositoryId) {
    return NextResponse.json(
      { error: "Analytics refresh was not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ job });
}
