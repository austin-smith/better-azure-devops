import { AppHeader } from "@/components/app-header";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Jobs" }]}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-80" />
          <Skeleton className="size-7" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </main>
    </>
  );
}
