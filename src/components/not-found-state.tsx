import Link from "next/link";
import { ArrowLeftIcon, HomeIcon, SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type NotFoundStateProps = {
  backHref: string;
  backLabel: string;
  description: string;
  title: string;
};

export function NotFoundState({
  backHref,
  backLabel,
  description,
  title,
}: NotFoundStateProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Button
          nativeButton={false}
          render={<Link href="/" />}
          size="sm"
          variant="ghost"
        >
          <HomeIcon data-icon="inline-start" />
          Home
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 p-4 md:p-6">
        <Empty className="mx-auto max-w-xl border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle className="text-base">{title}</EmptyTitle>
            <EmptyDescription>{description}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href={backHref} />}
              variant="outline"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              {backLabel}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </div>
  );
}
