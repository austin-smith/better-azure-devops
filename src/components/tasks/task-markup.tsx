"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type TaskMarkupProps = {
  className?: string;
  emptyMessage?: string;
  html?: string;
  markdown?: string;
  text?: string;
};

const proseClassName =
  "prose prose-sm max-w-none text-foreground dark:prose-invert";
const mentionClassName =
  "[&_[data-vss-mention]]:rounded-md [&_[data-vss-mention]]:bg-sky-500/12 [&_[data-vss-mention]]:px-1.5 [&_[data-vss-mention]]:py-0.5 [&_[data-vss-mention]]:font-medium [&_[data-vss-mention]]:text-sky-700 [&_[data-vss-mention]]:ring-1 [&_[data-vss-mention]]:ring-inset [&_[data-vss-mention]]:ring-sky-500/25 [&_[data-vss-mention]]:no-underline dark:[&_[data-vss-mention]]:bg-sky-400/15 dark:[&_[data-vss-mention]]:text-sky-200 dark:[&_[data-vss-mention]]:ring-sky-400/30";

export function TaskMarkup({
  className,
  emptyMessage,
  html,
  markdown,
  text,
}: TaskMarkupProps) {
  if (html?.trim()) {
    return (
      <div
        className={cn(proseClassName, mentionClassName, className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (markdown?.trim()) {
    return (
      <div className={cn(proseClassName, mentionClassName, className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    );
  }

  if (text?.trim()) {
    return (
      <div className={cn("whitespace-pre-wrap text-sm leading-relaxed", className)}>
        {text}
      </div>
    );
  }

  return emptyMessage ? (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      {emptyMessage}
    </div>
  ) : null;
}
