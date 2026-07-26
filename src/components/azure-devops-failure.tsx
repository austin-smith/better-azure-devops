"use client";

import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PublicAzureDevOpsError } from "@/lib/azure-devops/errors";
import { cn } from "@/lib/utils";

type AzureDevOpsFailureProps = {
  className?: string;
  error: PublicAzureDevOpsError;
  onRetry?: () => void;
};

export function AzureDevOpsFailure({
  className,
  error,
  onRetry,
}: AzureDevOpsFailureProps) {
  const retry = onRetry ?? (() => window.location.reload());

  return (
    <Alert className={cn("py-3", className)} variant="destructive">
      <AlertTriangleIcon />
      <AlertTitle>{error.title}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>
          {error.message}
          {typeof error.retryAfterSeconds !== "number"
            ? null
            : ` Try again in about ${error.retryAfterSeconds} seconds.`}
        </p>
        {error.command ? (
          <code className="max-w-full overflow-x-auto rounded-md border bg-muted px-2 py-1 font-mono text-xs text-foreground">
            {error.command}
          </code>
        ) : null}
        {error.canRetry && error.actionLabel ? (
          <Button onClick={retry} size="sm" type="button" variant="outline">
            <RefreshCwIcon data-icon="inline-start" />
            {error.actionLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
