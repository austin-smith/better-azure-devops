"use client";

import { ChevronDownIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState, useId } from "react";
import {
  INITIAL_PULL_REQUEST_ACTION_STATE,
  type PullRequestActionState,
} from "@/lib/repositories/pull-request-action-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AzureGitPullRequestThreadStatus } from "@/lib/azure-devops/git/types";
import { getThreadStatusPresentation } from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<
  Exclude<AzureGitPullRequestThreadStatus, "unknown">
> = ["active", "pending", "fixed", "wontFix", "byDesign", "closed"];

export function RepositoryPullRequestThreadControl({
  action,
  status,
}: {
  action: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  status: AzureGitPullRequestThreadStatus;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_PULL_REQUEST_ACTION_STATE,
  );
  const formId = useId();
  const current = getThreadStatusPresentation(status);

  return (
    <>
      {/* Options submit directly so resolving a thread is one action rather
          than a select followed by a separate confirm. */}
      <form action={formAction} id={formId} />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={
            <Button
              aria-label={`Thread status: ${current.label}`}
              className={cn("h-5 gap-1 px-2 text-xs", current.className)}
              size="xs"
              variant="outline"
            />
          }
        >
          {pending ? (
            <LoaderCircleIcon className="animate-spin" />
          ) : null}
          {current.label}
          <ChevronDownIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Set thread status</DropdownMenuLabel>
            {STATUS_OPTIONS.map((option) => {
              const presentation = getThreadStatusPresentation(option);

              return (
                <DropdownMenuItem
                  key={option}
                  render={
                    <button
                      form={formId}
                      name="status"
                      type="submit"
                      value={option}
                    />
                  }
                >
                  <span className={cn(option === status && "font-medium")}>
                    {presentation.label}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {state.status === "error" && state.message ? (
        <span aria-live="polite" className="text-xs text-destructive">
          {state.message}
        </span>
      ) : null}
    </>
  );
}
