"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangleIcon, HomeIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type RouteFailureStateProps = {
  error: Error & { digest?: string };
  message: string;
  title: string;
  unstableRetry: () => void;
};

export function RouteFailureState({
  error,
  message,
  title,
  unstableRetry,
}: RouteFailureStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Button
          nativeButton={false}
          render={<Link href="/" />}
          size="sm"
          variant="ghost"
        >
          <HomeIcon data-icon="inline-start" />
          Home
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 p-4 md:p-6">
        <Empty className="mx-auto max-w-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangleIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base">{title}</EmptyTitle>
            <EmptyDescription>
              {message}
              {error.digest ? (
                <span className="mt-2 block font-mono text-xs">
                  Reference: {error.digest}
                </span>
              ) : null}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={unstableRetry} type="button">
                <RefreshCwIcon data-icon="inline-start" />
                Try again
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/" />}
                variant="outline"
              >
                <HomeIcon data-icon="inline-start" />
                Return home
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
