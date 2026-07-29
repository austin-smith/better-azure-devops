import type {
  JobHistorySearchParams,
  JobHistoryStatus,
} from "@/lib/job-history/types";

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseJobHistorySearchParams(
  searchParams: JobHistorySearchParams,
) {
  const rawPage = firstSearchParam(searchParams.page);
  const page = Number(rawPage);
  const rawStatus = firstSearchParam(searchParams.status);
  const status: JobHistoryStatus =
    rawStatus === "active" ||
    rawStatus === "completed" ||
    rawStatus === "failed"
      ? rawStatus
      : "all";

  return {
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    status,
  };
}

export function getJobHistoryHref(input: {
  page?: number;
  status: JobHistoryStatus;
}) {
  const searchParams = new URLSearchParams();

  if (input.status !== "all") {
    searchParams.set("status", input.status);
  }

  if (input.page && input.page > 1) {
    searchParams.set("page", String(input.page));
  }

  const query = searchParams.toString();

  return query ? `/jobs?${query}` : "/jobs";
}
