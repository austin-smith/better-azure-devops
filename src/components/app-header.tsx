"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type AppHeaderItem = {
  href?: string;
  label: string;
};

type AppHeaderProps = {
  actions?: ReactNode;
  items: AppHeaderItem[];
};

export function AppHeader({
  actions,
  items,
}: AppHeaderProps) {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mr-1 h-4 data-[orientation=vertical]:h-4"
          orientation="vertical"
        />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="min-w-0">
            {items.map((item, index) => {
              const isCurrentPage = index === items.length - 1;

              return (
                <Fragment key={`${item.label}-${index}`}>
                  <BreadcrumbItem className="min-w-0">
                    {isCurrentPage || !item.href ? (
                      <BreadcrumbPage className="truncate">
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <Link
                        className="truncate"
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    )}
                  </BreadcrumbItem>
                  {isCurrentPage ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
