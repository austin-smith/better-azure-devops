import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { createAzureDevOpsErrorResponse } from "@/lib/azure-devops/error-response";
import { getRepository } from "@/lib/azure-devops/git/repositories";
import { parseAnalyticsRange } from "@/lib/analytics/filters";
import { loadRepositoryAnalyticsReport } from "@/lib/analytics/report";

function csvCell(value: string | number) {
  const raw = String(value);
  const text =
    typeof value === "string" && /^[=+\-@\t\r]/.test(value)
      ? `'${raw}`
      : raw;

  return /[",\r\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function buildContributorCsv(
  report: ReturnType<typeof loadRepositoryAnalyticsReport>,
) {
  const header = [
    "contributor_id",
    "contributor",
    "completed_pull_requests",
    "lines_added",
    "lines_deleted",
    "total_churn",
    "distinct_files_touched",
    "distinct_merge_days_utc",
  ];
  const rows = report.contributors.map((contributor) => [
    contributor.id,
    contributor.displayName,
    contributor.pullRequests,
    contributor.additions,
    contributor.deletions,
    contributor.churn,
    contributor.filesTouched,
    contributor.mergeDays,
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ projectId: string; repositoryId: string }>;
  },
) {
  const { projectId, repositoryId } = await context.params;
  const url = new URL(request.url);
  const branch = url.searchParams.get("branch")?.trim();
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  if (!branch) {
    return Response.json(
      { error: "A branch is required." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const repository = await getRepository(
      accessToken,
      projectId,
      repositoryId,
    );
    const report = loadRepositoryAnalyticsReport({
      branch,
      range: parseAnalyticsRange(url.searchParams.get("range")),
      repositoryId,
    });
    const safeName =
      repository.name.replaceAll(/[^a-z0-9_-]+/gi, "-") || "repository";

    if (format === "csv") {
      return new Response(buildContributorCsv(report), {
        headers: {
          "Content-Disposition": `attachment; filename="${safeName}-contributors.csv"`,
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    return Response.json(report, {
      headers: {
        "Content-Disposition": `attachment; filename="${safeName}-analytics.json"`,
      },
    });
  } catch (error) {
    return createAzureDevOpsErrorResponse(error);
  }
}
