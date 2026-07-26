import { Fragment } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { GitVersionDescriptor } from "@/lib/azure-devops/git/types";
import {
  getRepositoryTreeHref,
  normalizeRepositoryPath,
} from "@/lib/azure-devops/git/urls";

export function RepositoryPathBreadcrumb({
  className,
  path,
  projectId,
  repositoryId,
  version,
}: {
  className?: string;
  path: string;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  const segments = normalizeRepositoryPath(path).split("/").filter(Boolean);
  const visibleSegments =
    segments.length > 4
      ? [segments[0], "...", ...segments.slice(-2)]
      : segments;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="flex-nowrap overflow-hidden">
        <BreadcrumbItem>
          {segments.length === 0 ? (
            <BreadcrumbPage>Files</BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              render={
                <Link
                  href={getRepositoryTreeHref(
                    projectId,
                    repositoryId,
                    "/",
                    version,
                  )}
                />
              }
            >
              Files
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {visibleSegments.map((segment, visibleIndex) => {
          if (segment === "...") {
            return (
              <Fragment key={`ellipsis-${visibleIndex}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbEllipsis />
                </BreadcrumbItem>
              </Fragment>
            );
          }

          const actualIndex =
            visibleSegments.length === segments.length
              ? visibleIndex
              : visibleIndex === 0
                ? 0
                : segments.length - (visibleSegments.length - visibleIndex);
          const segmentPath = `/${segments
            .slice(0, actualIndex + 1)
            .join("/")}`;
          const isLast = actualIndex === segments.length - 1;

          return (
            <Fragment key={segmentPath}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">
                    {segment}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    className="truncate"
                    render={
                      <Link
                        href={getRepositoryTreeHref(
                          projectId,
                          repositoryId,
                          segmentPath,
                          version,
                        )}
                      />
                    }
                  >
                    {segment}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
