import { Skeleton } from "@/components/ui/skeleton";

export default function RepositoryLoading() {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
