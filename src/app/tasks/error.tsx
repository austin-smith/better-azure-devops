"use client";

import { RouteFailureState } from "@/components/route-failure-state";

export default function TasksError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteFailureState
      error={error}
      message="An unexpected error interrupted the work-item view. Retry without losing the rest of the app shell."
      title="Work items could not load"
      unstableRetry={unstable_retry}
    />
  );
}
