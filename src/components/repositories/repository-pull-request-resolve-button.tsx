"use client";

import { CheckIcon, LoaderCircleIcon, RotateCcwIcon } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  INITIAL_PULL_REQUEST_ACTION_STATE,
  type PullRequestActionState,
} from "@/lib/repositories/pull-request-action-state";
import type { AzureGitPullRequestThreadStatus } from "@/lib/azure-devops/git/types";

/**
 * The one-click path for the only status change most threads ever need. The
 * header dropdown still covers the rarer states such as "Won't fix"; this
 * mirrors Azure DevOps, where the action reads "Reactivate" once a thread is
 * resolved rather than staying a generic control.
 */
export function RepositoryPullRequestResolveButton({
  action,
  isResolved,
}: {
  action: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  isResolved: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_PULL_REQUEST_ACTION_STATE,
  );

  // Deliberately not a <form>: the button renders inside the reply
  // composer's form when the composer is open, and forms cannot nest. The
  // action is dispatched through a transition instead.
  function submit() {
    const formData = new FormData();

    formData.set("status", isResolved ? "active" : "fixed");
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Default button size matches the h-8 collapsed composer beside it. */}
      <Button
        disabled={pending}
        onClick={submit}
        type="button"
        variant="outline"
      >
        {pending ? (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        ) : isResolved ? (
          <RotateCcwIcon data-icon="inline-start" />
        ) : (
          <CheckIcon data-icon="inline-start" />
        )}
        {isResolved ? "Reactivate" : "Resolve"}
      </Button>
      {state.status === "error" && state.message ? (
        <span aria-live="polite" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
    </div>
  );
}

export function getThreadResolvedState(
  status: AzureGitPullRequestThreadStatus,
) {
  return (
    status === "byDesign" ||
    status === "closed" ||
    status === "fixed" ||
    status === "wontFix"
  );
}
