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
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { ImageLightbox } from "@/components/image-lightbox";
import { cn } from "@/lib/utils";
import {
  buildAzureDevOpsAssetProxyPath,
  isProxyableAzureDevOpsAssetUrl,
} from "@/lib/azure-devops/assets";
import {
  sanitizeAzureDevOpsHtml,
  type AzureDevOpsMarkup,
} from "@/lib/azure-devops/markup";

export type AzureDevOpsMarkupViewProps = {
  blockExternalImages?: boolean;
  className?: string;
  emptyMessage?: string;
  markup?: AzureDevOpsMarkup | null;
  onTaskCheckedChange?: (taskIndex: number, checked: boolean) => void;
};

/**
 * Typography ships an article rhythm: 24px lines, 16px between paragraphs, and
 * 23px around code blocks. In a review tool that is a few hundred pixels of
 * empty space inside a single comment. Only the spacing is tightened; the type
 * size is untouched, so nothing becomes harder to read.
 *
 * Typography already zeroes the first and last child margins, so leading and
 * trailing gaps need no handling here.
 */
const proseSpacingClassName =
  "leading-normal prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-blockquote:my-2 prose-hr:my-3 prose-headings:mt-4 prose-headings:mb-1.5 prose-table:my-2";

/**
 * Typography's own scale sizes a description `h1` at 30px, larger than the 18px
 * title of the page containing it, so authored content dominated the interface
 * around it. Headings are capped at the surrounding title size and step down
 * from there.
 *
 * Images get a height ceiling and nothing else: a border or rounded corner is
 * decoration this view has no business adding to someone's screenshot.
 */
const proseClassName =
  "prose prose-sm min-w-0 max-w-none overflow-x-auto break-words text-foreground dark:prose-invert prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-h4:text-sm prose-h5:text-sm prose-h6:text-sm prose-img:max-h-96 prose-img:w-auto";
const mentionPillClassName =
  "rounded-md bg-sky-500/12 px-1.5 py-0.5 font-medium text-sky-700 ring-1 ring-inset ring-sky-500/25 no-underline dark:bg-sky-400/15 dark:text-sky-200 dark:ring-sky-400/30";
const mentionClassName =
  "[&_[data-vss-mention]]:rounded-md [&_[data-vss-mention]]:bg-sky-500/12 [&_[data-vss-mention]]:px-1.5 [&_[data-vss-mention]]:py-0.5 [&_[data-vss-mention]]:font-medium [&_[data-vss-mention]]:text-sky-700 [&_[data-vss-mention]]:ring-1 [&_[data-vss-mention]]:ring-inset [&_[data-vss-mention]]:ring-sky-500/25 [&_[data-vss-mention]]:no-underline dark:[&_[data-vss-mention]]:bg-sky-400/15 dark:[&_[data-vss-mention]]:text-sky-200 dark:[&_[data-vss-mention]]:ring-sky-400/30";
const azureDevOpsMentionHrefPrefix = "./ado-mention/";

/**
 * Review tools write collapsible sections as raw `<details>` blocks. Markdown
 * was rendered with `skipHtml`, which dropped the tags and spilled every
 * collapsed section inline, so a single automated comment buried the thread.
 *
 * Raw HTML is parsed by `rehype-raw` and then sanitized, because pull request
 * comments are untrusted input. The default schema already permits
 * `details`/`summary` but drops two attributes this view depends on.
 */
const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Task list checkboxes are rendered from their `checked` state, which the
    // default schema strips while keeping the input itself.
    input: [...(defaultSchema.attributes?.input ?? []), "checked"],
    // Alternative text and titles are dropped by default, which would leave
    // every embedded image unlabelled.
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "title"],
  },
};

/**
 * Embedded Azure DevOps attachments need the authenticated asset proxy;
 * anything else keeps the source it was authored with.
 */
function resolveMarkupImageSource(
  source: unknown,
  blockExternalImages = false,
) {
  if (typeof source !== "string") {
    return undefined;
  }

  if (isProxyableAzureDevOpsAssetUrl(source)) {
    return buildAzureDevOpsAssetProxyPath(source);
  }

  return blockExternalImages && /^(?:https?:)?\/\//i.test(source)
    ? null
    : source;
}

const collapsibleSectionClassName =
  "[&_details]:my-2 [&_details]:rounded-md [&_details]:border [&_details]:px-3 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:marker:text-muted-foreground";

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
  onTaskCheckedChange?: AzureDevOpsMarkupViewProps["onTaskCheckedChange"],
  blockExternalImages = false,
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
    img({ node, src, ...props }) {
      void node;
      const resolvedSource = resolveMarkupImageSource(
        src,
        blockExternalImages,
      );

      if (!resolvedSource) {
        return (
          <span className="text-muted-foreground">
            {props.alt
              ? `[Image blocked: ${props.alt}]`
              : "External image blocked"}
          </span>
        );
      }

      return (
        // Markdown images are remote user content without known dimensions.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          {...props}
          alt={props.alt ?? ""}
          decoding={props.decoding ?? "async"}
          loading={props.loading ?? "lazy"}
          src={resolvedSource}
        />
      );
    },
    input({ checked, disabled, node, type, ...props }) {
      void node;

      const taskIndex = taskCheckboxIndex;
      const isCheckbox = type === "checkbox";
      // Raw HTML round trips only serialize boolean attributes when they are
      // true, so an unchecked task box arrives with no `checked` at all. Its
      // absence means unchecked, not "not a task checkbox".
      const isChecked = isCheckbox ? checked === true : checked;
      const isEditableTaskCheckbox =
        isCheckbox && typeof onTaskCheckedChange === "function";

      if (isCheckbox) {
        taskCheckboxIndex += 1;
      }

      return (
        <input
          {...props}
          aria-label={type === "checkbox"
            ? props["aria-label"] ?? `Task ${taskIndex + 1}`
            : props["aria-label"]}
          checked={isChecked}
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

export function AzureDevOpsMarkupView({
  blockExternalImages = false,
  className,
  emptyMessage,
  markup,
  onTaskCheckedChange,
}: AzureDevOpsMarkupViewProps) {
  if (markup?.content.trim()) {
    switch (markup.format) {
      case "html":
        return (
          <ImageLightbox
            className={cn(
              proseClassName,
              proseSpacingClassName,
              mentionClassName,
              className,
            )}
            dangerouslySetInnerHTML={{
              __html: sanitizeAzureDevOpsHtml(markup.content, {
                transformImageSource: (source) =>
                  resolveMarkupImageSource(source, blockExternalImages),
              }),
            }}
          />
        );
      case "markdown":
        return (
          <ImageLightbox
            className={cn(
              proseClassName,
              proseSpacingClassName,
              mentionClassName,
              collapsibleSectionClassName,
              className,
            )}
          >
            <ReactMarkdown
              components={createMarkdownComponents(
                onTaskCheckedChange,
                blockExternalImages,
              )}
              rehypePlugins={[
                rehypeRaw,
                [rehypeSanitize, markdownSanitizeSchema],
              ]}
              remarkPlugins={[remarkGfm]}
            >
              {markup.content}
            </ReactMarkdown>
          </ImageLightbox>
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
