import { getServerSession } from "next-auth";
import { AuthButton } from "@/components/auth-button";
import { authOptions, hasMicrosoftEntraConfig } from "@/lib/auth";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { getTask, listTasks } from "@/lib/azure-devops/tasks";

const views = ["Mine", "Active", "Recent", "Unassigned"];

export default async function Home() {
  const authConfigured = hasMicrosoftEntraConfig();
  const session = authConfigured ? await getServerSession(authOptions) : null;
  const configured = authConfigured && hasAzureDevOpsConfig();
  const signedIn = Boolean(session?.accessToken);
  const tasks =
    configured && session?.accessToken
      ? await listTasks(session.accessToken, "mine", 25).catch(() => [])
      : [];
  const selectedTask =
    configured && session?.accessToken && tasks[0]
      ? await getTask(session.accessToken, tasks[0].id).catch(() => null)
      : null;

  return (
    <>
      {/* Top accent strip */}
      <div className="h-[2px] bg-gradient-to-r from-accent via-accent/50 to-transparent" />

      <main className="flex min-h-[calc(100vh-2px)] flex-col">
        {/* Header */}
        <header className="border-b bg-surface/50 px-6 py-3">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between">
            <div className="flex items-center gap-5">
              <h1 className="font-display text-[15px] font-bold uppercase tracking-[0.1em]">
                Task Surface
              </h1>
              <div className="h-4 w-px bg-border-strong" />
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    configured
                      ? "bg-success animate-pulse-dot"
                      : "bg-warning"
                  }`}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-muted">
                  {configured ? "Connected" : "Not configured"}
                </span>
              </div>
            </div>
            <AuthButton enabled={authConfigured} signedIn={signedIn} />
          </div>
        </header>

        {/* Content */}
        <div className="mx-auto flex flex-1 w-full max-w-[1440px]">
          {/* Sidebar */}
          <aside className="hidden w-[200px] shrink-0 border-r p-3 pt-4 lg:block">
            <div className="mb-3 px-3">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted">
                Views
              </span>
            </div>
            <nav className="space-y-0.5">
              {views.map((view, index) => (
                <button
                  key={view}
                  type="button"
                  className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors ${
                    index === 0
                      ? "bg-surface-raised text-text"
                      : "text-text-muted hover:bg-surface-raised/50 hover:text-text"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {index === 0 && (
                      <span className="h-1 w-1 rounded-full bg-accent" />
                    )}
                    <span>{view}</span>
                  </span>
                  {index === 0 && tasks.length > 0 && (
                    <span className="font-mono text-[10px] tabular-nums text-accent">
                      {tasks.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </aside>

          {/* Task List */}
          <section className="flex flex-1 flex-col border-r">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Inbox
              </h2>
              <span className="font-mono text-[10px] tabular-nums text-text-muted">
                {tasks.length} items
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!configured ? (
                <EmptyState
                  message="Connect Azure DevOps"
                  sub="Missing Microsoft Entra or Azure DevOps configuration."
                />
              ) : !signedIn ? (
                <EmptyState
                  message="Sign in to continue"
                  sub="Authenticate with Microsoft to access your work items."
                />
              ) : tasks.length === 0 ? (
                <EmptyState message="No tasks" sub="Your inbox is clear." />
              ) : (
                <div>
                  {tasks.map((task, index) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`animate-fade-up group relative flex w-full items-center gap-4 border-b px-5 py-3 text-left text-sm transition-colors ${
                        index === 0
                          ? "bg-surface-raised"
                          : "hover:bg-surface-raised/40"
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {index === 0 && (
                        <span className="absolute inset-y-2 left-0 w-[2px] rounded-r bg-accent" />
                      )}
                      <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                        {task.id}
                      </span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase leading-none tracking-wider ${stateColor(
                          task.state
                        )}`}
                      >
                        {task.state ?? "\u2014"}
                      </span>
                      <span className="truncate">{task.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Detail Panel */}
          <aside className="hidden w-[360px] shrink-0 overflow-y-auto lg:block">
            {selectedTask ? (
              <div className="animate-fade-up space-y-5 p-5">
                <div>
                  <span className="font-mono text-[10px] tabular-nums text-text-muted">
                    #{selectedTask.id}
                  </span>
                  <h3 className="mt-1 font-display text-lg font-bold leading-snug tracking-tight">
                    {selectedTask.title}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <MetaCard
                    label="State"
                    value={selectedTask.state ?? "Unknown"}
                  />
                  <MetaCard
                    label="Assignee"
                    value={
                      selectedTask.assignedTo?.displayName ?? "Unassigned"
                    }
                  />
                </div>

                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                    Description
                  </div>
                  <div className="rounded border bg-surface p-4 text-sm leading-relaxed text-text-muted">
                    {selectedTask.description ??
                      selectedTask.iterationPath ??
                      selectedTask.areaPath ??
                      "No details available."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex justify-center">
                    <span className="block h-6 w-[2px] bg-border-strong" />
                  </div>
                  <p className="text-xs text-text-muted">Select a task</p>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-8">
      <div className="mb-4 h-px w-10 bg-border-strong" />
      <p className="font-display text-sm font-semibold tracking-tight">
        {message}
      </p>
      <p className="mt-1.5 max-w-[240px] text-center text-xs leading-relaxed text-text-muted">
        {sub}
      </p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-surface p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function stateColor(state: string | null | undefined): string {
  switch (state?.toLowerCase()) {
    case "active":
    case "in progress":
      return "bg-accent/10 text-accent";
    case "new":
      return "bg-sky-500/10 text-sky-400";
    case "closed":
    case "done":
    case "resolved":
      return "bg-success/10 text-success";
    default:
      return "bg-surface-raised text-text-muted";
  }
}
