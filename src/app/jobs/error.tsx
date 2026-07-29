"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function JobsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Jobs" }]}
      />
      <Empty className="m-3 min-h-96 border md:m-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>Job history did not load</EmptyTitle>
          <EmptyDescription>
            The local job history could not be read.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset} variant="outline">
            <RefreshCwIcon data-icon="inline-start" />
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </>
  );
}
