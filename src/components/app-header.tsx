"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
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
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background">
      <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          className="mr-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
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
                      <BreadcrumbLink
                        className="truncate"
                        render={<Link href={item.href} />}
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {isCurrentPage ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {actions ? <div className="ml-auto flex items-center gap-2 px-4">{actions}</div> : null}
    </header>
  );
}
