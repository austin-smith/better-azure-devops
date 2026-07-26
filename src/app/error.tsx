"use client";

import { RouteFailureState } from "@/components/route-failure-state";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteFailureState
      error={error}
      message="The page encountered an unexpected problem. Retry the request, and use the reference code to check server logs if it continues."
      title="This page could not load"
      unstableRetry={unstable_retry}
    />
  );
}
