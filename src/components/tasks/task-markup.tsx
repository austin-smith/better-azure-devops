"use client";

import type { Components } from "react-markdown";
import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentProps,
  type ReactNode,
  type ReactElement,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  sanitizeAzureDevOpsHtml,
  type AzureDevOpsMarkup,
} from "@/lib/azure-devops/markup";

type TaskMarkupProps = {
  className?: string;
  emptyMessage?: string;
  markup?: AzureDevOpsMarkup | null;
  onTaskCheckedChange?: (taskIndex: number, checked: boolean) => void;
};

const proseClassName =
  "prose prose-sm min-w-0 max-w-none overflow-x-auto break-words text-foreground dark:prose-invert";
const mentionPillClassName =
  "rounded-md bg-sky-500/12 px-1.5 py-0.5 font-medium text-sky-700 ring-1 ring-inset ring-sky-500/25 no-underline dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/30";
const mentionClassName =
  "[&_[data-vss-mention]]:rounded-md [&_[data-vss-mention]]:bg-sky-500/12 [&_[data-vss-mention]]:px-1.5 [&_[data-vss-mention]]:py-0.5 [&_[data-vss-mention]]:font-medium [&_[data-vss-mention]]:text-sky-700 [&_[data-vss-mention]]:ring-1 [&_[data-vss-mention]]:ring-inset [&_[data-vss-mention]]:ring-sky-500/25 [&_[data-vss-mention]]:no-underline dark:[&_[data-vss-mention]]:bg-sky-400/15 dark:[&_[data-vss-mention]]:text-sky-200 dark:[&_[data-vss-mention]]:ring-sky-400/30";
const azureDevOpsMentionHrefPrefix = "./ado-mention/";

function isExternalHref(href: string | undefined) {
  return /^https?:\/\//i.test(href ?? "");
}

function decodeAzureDevOpsMentionId(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function textFromReactNode(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(textFromReactNode).join("");
  }

  if (isValidElement<{ alt?: string; children?: ReactNode }>(value)) {
    if (value.type === "input") {
      return "";
    }

    if (typeof value.props.alt === "string") {
      return value.props.alt ?? "";
    }

    return textFromReactNode(value.props.children);
  }

  return "";
}

function taskCheckboxLabel(children: ReactNode) {
  const labelParts: string[] = [];

  Children.forEach(children, (child) => {
    if (isTaskCheckboxElement(child)) {
      return;
    }

    if (
      isValidElement(child) &&
      (child.type === "ul" || child.type === "ol")
    ) {
      return;
    }

    labelParts.push(textFromReactNode(child));
  });

  return labelParts.join("").replace(/\s+/g, " ").trim();
}

function isTaskCheckboxElement(
  value: ReactNode,
): value is ReactElement<ComponentProps<"input">> {
  return isValidElement<ComponentProps<"input">>(value) &&
    value.props.type === "checkbox";
}

function createMarkdownComponents(
  onTaskCheckedChange?: TaskMarkupProps["onTaskCheckedChange"],
): Components {
  let taskCheckboxIndex = 0;

  return {
    a({ children, href, node, ...props }) {
      void node;

      if (href?.startsWith(azureDevOpsMentionHrefPrefix)) {
        const mentionId = decodeAzureDevOpsMentionId(
          href.slice(azureDevOpsMentionHrefPrefix.length),
        );

        return (
          <span
            {...props}
            className={cn(mentionPillClassName, props.className)}
            data-vss-mention={mentionId}
          >
            {children}
          </span>
        );
      }

      const isExternal = isExternalHref(href);

      return (
        <a
          href={href}
          rel={isExternal ? "noreferrer noopener" : undefined}
          target={isExternal ? "_blank" : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    img({ node, ...props }) {
      void node;

      return (
        // Markdown images are remote user content without known dimensions.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...props}
          alt={props.alt ?? ""}
          decoding={props.decoding ?? "async"}
          loading={props.loading ?? "lazy"}
        />
      );
    },
    input({ checked, disabled, node, type, ...props }) {
      void node;

      const taskIndex = taskCheckboxIndex;
      const isEditableTaskCheckbox =
        type === "checkbox" &&
        typeof checked === "boolean" &&
        typeof onTaskCheckedChange === "function";

      if (type === "checkbox") {
        taskCheckboxIndex += 1;
      }

      return (
        <input
          {...props}
          aria-label={type === "checkbox"
            ? props["aria-label"] ?? `Task ${taskIndex + 1}`
            : props["aria-label"]}
          checked={checked}
          disabled={isEditableTaskCheckbox ? false : disabled}
          onChange={isEditableTaskCheckbox
            ? (event) => {
                onTaskCheckedChange?.(taskIndex, event.currentTarget.checked);
              }
            : props.onChange}
          type={type}
        />
      );
    },
    li({ children, node, ...props }) {
      void node;

      const checkboxLabel = taskCheckboxLabel(children);
      const labeledChildren = checkboxLabel
        ? Children.map(children, (child) =>
            isTaskCheckboxElement(child)
              ? cloneElement(child, { "aria-label": checkboxLabel })
              : child,
          )
        : children;

      return <li {...props}>{labeledChildren}</li>;
    },
  };
}

export function TaskMarkup({
  className,
  emptyMessage,
  markup,
  onTaskCheckedChange,
}: TaskMarkupProps) {
  if (markup?.content.trim()) {
    switch (markup.format) {
      case "html":
        return (
          <div
            className={cn(proseClassName, mentionClassName, className)}
            dangerouslySetInnerHTML={{
              __html: sanitizeAzureDevOpsHtml(markup.content),
            }}
          />
        );
      case "markdown":
        return (
          <div className={cn(proseClassName, mentionClassName, className)}>
            <ReactMarkdown
              components={createMarkdownComponents(onTaskCheckedChange)}
              remarkPlugins={[remarkGfm]}
              skipHtml
            >
              {markup.content}
            </ReactMarkdown>
          </div>
        );
      case "unknown":
        return (
          <div
            className={cn(
              "min-w-0 overflow-x-auto whitespace-pre-wrap break-words text-sm leading-relaxed",
              className,
            )}
          >
            {markup.content}
          </div>
        );
    }
  }

  return emptyMessage ? (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      {emptyMessage}
    </div>
  ) : null;
}
