import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RepositoryContentImage } from "@/components/repositories/repository-content-image";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";
import {
  getRepositoryBlobHref,
  getRepositoryContentHref,
  resolveRelativeRepositoryPath,
} from "@/lib/azure-devops/git/urls";

function isAllowedExternalUrl(value: string) {
  try {
    const url = new URL(value);

    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isAllowedExternalImageUrl(value: string) {
  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);

    return true;
  } catch {
    return value.startsWith("//");
  }
}

function getNodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

export function RepositoryMarkdown({
  content,
  path,
  projectId,
  repositoryId,
  version,
}: {
  content: string;
  path: string;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const slugCounts = new Map<string, number>();

  function getHeadingId(children: ReactNode) {
    const base =
      getNodeText(children)
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, "")
        .replace(/\s+/g, "-") || "section";
    const count = slugCounts.get(base) ?? 0;

    slugCounts.set(base, count + 1);

    return count === 0 ? base : `${base}-${count}`;
  }

  return (
    <article className="repository-markdown prose prose-neutral mx-auto w-full max-w-[92ch] p-5 dark:prose-invert md:p-7">
      <ReactMarkdown
        components={{
          a({ children, href }) {
            if (!href) {
              return <span>{children}</span>;
            }

            if (href.startsWith("#")) {
              return <a href={href}>{children}</a>;
            }

            if (isAllowedExternalUrl(href)) {
              return (
                <a
                  href={href}
                  rel="noreferrer noopener"
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                >
                  {children}
                </a>
              );
            }

            const resolvedPath = resolveRelativeRepositoryPath(path, href);
            const hashIndex = href.indexOf("#");
            const fragment = hashIndex >= 0 ? href.slice(hashIndex) : "";

            return (
              <Link
                href={`${getRepositoryBlobHref(
                  projectId,
                  repositoryId,
                  resolvedPath,
                  version,
                )}${fragment}`}
              >
                {children}
              </Link>
            );
          },
          h1({ children }) {
            return <h1 id={getHeadingId(children)}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 id={getHeadingId(children)}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 id={getHeadingId(children)}>{children}</h3>;
          },
          h4({ children }) {
            return <h4 id={getHeadingId(children)}>{children}</h4>;
          },
          h5({ children }) {
            return <h5 id={getHeadingId(children)}>{children}</h5>;
          },
          h6({ children }) {
            return <h6 id={getHeadingId(children)}>{children}</h6>;
          },
          img({ alt, src, title }) {
            if (!src || typeof src !== "string") {
              return null;
            }

            if (isAllowedExternalImageUrl(src)) {
              return (
                <a href={src} rel="noreferrer noopener" target="_blank">
                  {alt || "External image"}
                </a>
              );
            }

            if (isAbsoluteUrl(src)) {
              return null;
            }

            const imageSrc = getRepositoryContentHref(
              projectId,
              repositoryId,
              resolveRelativeRepositoryPath(path, src),
              version,
            );

            return (
              /* Height is capped so one screenshot cannot swallow the page.
                 A border or rounded corner would be decoration added to the
                 author's own image, so nothing else is applied. */
              <RepositoryContentImage
                alt={alt ?? ""}
                className="max-h-[32rem]"
                src={imageSrc}
                title={title ?? undefined}
              />
            );
          },
          table({ children }) {
            return (
              <div className="repository-markdown-table" tabIndex={0}>
                <table>{children}</table>
              </div>
            );
          },
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
