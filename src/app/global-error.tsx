"use client";

import { useEffect } from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import "./globals.css";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-svh bg-background p-4 text-foreground antialiased md:p-8">
        <title>Application error</title>
        <Empty className="m-auto max-w-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangleIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base">
              The application shell could not load
            </EmptyTitle>
            <EmptyDescription>
              Retry the application. If the problem continues, check the server
              logs
              {error.digest ? ` using reference ${error.digest}` : ""}.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={unstable_retry} type="button">
              <RefreshCwIcon data-icon="inline-start" />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      </body>
    </html>
  );
}
