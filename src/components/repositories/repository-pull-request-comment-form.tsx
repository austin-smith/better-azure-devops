"use client";

import { LoaderCircleIcon, SendIcon } from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  INITIAL_PULL_REQUEST_ACTION_STATE,
  type PullRequestActionState,
} from "@/lib/repositories/pull-request-action-state";
import { cn } from "@/lib/utils";

type PullRequestCommentFormProps = {
  action: (
    previousState: PullRequestActionState,
    formData: FormData,
  ) => Promise<PullRequestActionState>;
  autoFocus?: boolean;
  className?: string;
  /**
   * Starts as a single line and opens on focus. Every thread rendering a full
   * height composer left the conversation mostly made of empty input boxes.
   */
  collapsible?: boolean;
  hiddenFields?: Record<string, number | string>;
  /**
   * Shows a Cancel button on non-collapsible composers whose lifetime the
   * parent controls, such as the inline diff composer tied to a selection.
   */
  onCancel?: () => void;
  /** Called after the action succeeds, once the form has been reset. */
  onSuccess?: () => void;
  placeholder?: string;
  /**
   * Companion controls that belong with the composer, such as a thread's
   * resolve button. Collapsed they sit on the single row beside the opener;
   * open they join the bottom action row so every action shares one line.
   * Must not contain a <form> — the open composer renders them inside its
   * own form element.
   */
  secondaryActions?: ReactNode;
  submitLabel?: string;
};

export function RepositoryPullRequestCommentForm({
  action,
  autoFocus = false,
  className,
  collapsible = false,
  hiddenFields,
  onCancel,
  onSuccess,
  placeholder = "Leave a comment…",
  secondaryActions,
  submitLabel = "Comment",
}: PullRequestCommentFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_PULL_REQUEST_ACTION_STATE,
  );
  const [isOpen, setIsOpen] = useState(!collapsible);
  const [handledState, setHandledState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onSuccessRef = useRef(onSuccess);

  // Collapsing is an adjustment to a new action result rather than a side
  // effect, so it is applied during render instead of from an effect.
  if (state !== handledState) {
    setHandledState(state);

    if (collapsible && state.status === "success") {
      setIsOpen(false);
    }
  }

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      onSuccessRef.current?.();
    }
  }, [state]);

  if (collapsible && !isOpen) {
    const opener = (
      <button
        className={cn(
          "flex h-8 w-full items-center rounded-lg border border-input bg-background px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 dark:bg-input/30",
          secondaryActions ? "min-w-48 flex-1" : className,
        )}
        onClick={() => {
          setIsOpen(true);
          // The composer is only useful open if the caret is already in it.
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
        type="button"
      >
        {placeholder}
      </button>
    );

    if (!secondaryActions) {
      return opener;
    }

    return (
      <div className={cn("flex flex-wrap items-start gap-2", className)}>
        {opener}
        {secondaryActions}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className={cn("flex flex-col gap-2", className)}
      ref={formRef}
    >
      {Object.entries(hiddenFields ?? {}).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <Textarea
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="min-h-24 resize-y"
        disabled={pending}
        maxLength={100_000}
        name="content"
        placeholder={placeholder}
        ref={textareaRef}
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          aria-live="polite"
          className={cn(
            "min-h-5 text-xs",
            state.status === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {state.message ||
            "Markdown, @mentions, #work items, and !pull requests are supported."}
        </p>
        <div className="flex items-center gap-2">
          {collapsible || onCancel ? (
            <Button
              disabled={pending}
              onClick={() => {
                if (collapsible) {
                  setIsOpen(false);
                }
                onCancel?.();
              }}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          ) : null}
          {secondaryActions}
          <Button disabled={pending} type="submit">
            {pending ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {pending ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
