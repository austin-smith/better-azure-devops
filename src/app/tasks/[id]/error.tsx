"use client";

import { RouteFailureState } from "@/components/route-failure-state";

export default function TaskDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteFailureState
      error={error}
      message="An unexpected error interrupted this work item. Retry to fetch a fresh copy from Azure DevOps."
      title="This work item could not load"
      unstableRetry={unstable_retry}
    />
  );
}
