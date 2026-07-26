import { AppHeader } from "@/components/app-header";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";

export default function RepositoriesLoading() {
  return (
    <>
      <AppHeader
        actions={<ThemeToggle />}
        items={[{ href: "/", label: "Home" }, { label: "Repositories" }]}
      />
      <div className="flex flex-col gap-3 p-3 md:p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-80" />
          <Skeleton className="ml-auto h-8 w-16" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </>
  );
}
