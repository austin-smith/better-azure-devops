import type { Job } from "@/lib/jobs";

export type JobHistoryStatus =
  | "active"
  | "all"
  | "completed"
  | "failed";

export type JobHistorySearchParams = {
  page?: string | string[];
  status?: string | string[];
};

export type JobHistoryItem = Pick<
  Job,
  | "attemptCount"
  | "availableAt"
  | "completedAt"
  | "createdAt"
  | "errorMessage"
  | "id"
  | "leaseExpiresAt"
  | "maxAttempts"
  | "progressCurrent"
  | "progressTotal"
  | "resourceId"
  | "resourceType"
  | "startedAt"
  | "status"
  | "type"
  | "updatedAt"
> & {
  description: string | null;
  label: string;
  resource: {
    description: string | null;
    href: string | null;
    label: string;
  };
};

export type JobHistoryPage = {
  counts: {
    active: number;
    all: number;
    completed: number;
    failed: number;
  };
  items: JobHistoryItem[];
  page: number;
  pageCount: number;
  status: JobHistoryStatus;
  total: number;
};
