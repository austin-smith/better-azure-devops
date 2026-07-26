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
import type { AzureGitPullRequestVote } from "@/lib/azure-devops/git/types";
import {
  getCheckToneTextClassName,
  getVotePresentation,
} from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

const VOTE_OPTIONS: AzureGitPullRequestVote[] = [10, 5, -5, -10, 0];

export function RepositoryPullRequestVoteForm({
  action,
  vote,
}: {
  action: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  vote: AzureGitPullRequestVote;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_PULL_REQUEST_ACTION_STATE,
  );
  const formId = useId();
  const current = getVotePresentation(vote);
  const CurrentIcon = current.icon;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">Your vote</p>
      {/* Menu items submit this form directly. Choosing a vote and then
          confirming it with a second control turned a one-step action into a
          form, and the trigger showed the raw numeric value. */}
      <form action={formAction} id={formId} />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={pending}
          render={
            <Button
              className="w-full justify-start"
              size="sm"
              variant="outline"
            />
          }
        >
          {pending ? (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          ) : (
            <CurrentIcon
              className={getCheckToneTextClassName(current.tone)}
              data-icon="inline-start"
            />
          )}
          <span className="truncate">{current.label}</span>
          <ChevronDownIcon className="ml-auto" data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Set your vote</DropdownMenuLabel>
            {VOTE_OPTIONS.map((option) => {
              const presentation = getVotePresentation(option);
              const OptionIcon = presentation.icon;

              return (
                <DropdownMenuItem
                  key={option}
                  render={
                    <button
                      form={formId}
                      name="vote"
                      type="submit"
                      value={String(option)}
                    />
                  }
                >
                  <OptionIcon
                    className={getCheckToneTextClassName(presentation.tone)}
                  />
                  <span className={cn(option === vote && "font-medium")}>
                    {presentation.label}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {state.message ? (
        <p
          aria-live="polite"
          className={cn(
            "text-xs",
            state.status === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
