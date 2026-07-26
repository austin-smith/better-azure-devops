import { AppHeader } from "@/components/app-header";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function HeaderActionSkeletons({ count = 2 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          className={index === count - 1 ? "size-8" : "h-8 w-24"}
          key={index}
        />
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <Card size="sm" className="h-full gap-0">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="size-7" />
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <Skeleton className="h-7 w-12" />
      </CardContent>
    </Card>
  );
}

function DashboardPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card className="min-h-52">
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <div
            aria-hidden="true"
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
            key={index}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-7" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      className="flex min-h-0 flex-1 flex-col"
    >
      <header
        aria-hidden="true"
        className="flex h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-4"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-8" />
          <Skeleton className="h-4 w-16" />
        </div>
        <HeaderActionSkeletons count={3} />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <KpiSkeleton key={index} />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <DashboardPanelSkeleton rows={1} />
            <DashboardPanelSkeleton />
            <DashboardPanelSkeleton />
            <DashboardPanelSkeleton rows={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TASK_LIST_COLUMN_WIDTHS = [
  "w-16",
  "w-auto",
  "w-40",
  "w-32",
  "w-32",
  "w-40",
] as const;

export function TaskListLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading work items"
      className="flex min-h-0 flex-1 flex-col"
    >
      <AppHeader
        actions={<HeaderActionSkeletons />}
        items={[{ href: "/", label: "Home" }, { label: "Work Items" }]}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div aria-hidden="true" className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-72 max-w-full" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-8 w-24" key={index} />
          ))}
        </div>
        <Skeleton className="h-4 w-28" />
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-background">
          <div className="h-full overflow-hidden">
            <Table className="table-fixed text-sm">
              <TableHeader>
                <TableRow>
                  {TASK_LIST_COLUMN_WIDTHS.map((width, index) => (
                    <TableHead className={width} key={index}>
                      <Skeleton className="h-3 w-14 max-w-full" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 9 }, (_, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {TASK_LIST_COLUMN_WIDTHS.map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton
                          className={
                            cellIndex === 1
                              ? "h-4 w-4/5"
                              : cellIndex === 5
                                ? "h-4 w-3/5"
                                : "h-4 w-2/3"
                          }
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSidebarSkeleton() {
  return (
    <aside className="w-full shrink-0 border-t p-4 lg:w-72 lg:border-t-0 lg:border-l">
      <div aria-hidden="true" className="flex flex-col gap-5">
        {Array.from({ length: 7 }, (_, index) => (
          <div className="flex flex-col gap-2" key={index}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className={index < 5 ? "h-9 w-full" : "h-4 w-4/5"} />
          </div>
        ))}
      </div>
    </aside>
  );
}

export function TaskDetailLoadingState() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading work item"
      className="flex min-h-0 flex-1 flex-col"
    >
      <AppHeader
        actions={<HeaderActionSkeletons count={1} />}
        items={[
          { href: "/", label: "Home" },
          { href: "/tasks", label: "Work Items" },
          { label: "Work Item" },
        ]}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          aria-hidden="true"
          className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-start md:px-6"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-2/3 max-w-xl" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-w-0 flex-1 p-4 md:p-6">
            <div aria-hidden="true" className="flex flex-col gap-3">
              <Skeleton className="h-4 w-28" />
              <Card size="sm" className="min-h-60 gap-0 py-0 shadow-none">
                <CardContent className="flex flex-col gap-3 p-4">
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-3 h-4 w-2/3" />
                  <Skeleton className="h-4 w-5/6" />
                </CardContent>
              </Card>
              <Skeleton className="mt-5 h-4 w-32" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
          <DetailSidebarSkeleton />
        </div>
      </div>
    </div>
  );
}
