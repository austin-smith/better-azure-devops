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

export default function RepositoriesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Repositories" }]}
      />
      <Empty className="m-3 min-h-96 border md:m-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircleIcon />
          </EmptyMedia>
          <EmptyTitle>Repository explorer did not load</EmptyTitle>
          <EmptyDescription>
            The request failed before the repository list could be rendered.
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
