// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TaskTable } from "@/components/tasks/task-table";
import { createPublicAzureDevOpsError } from "@/lib/azure-devops/errors";
import { getDefaultTaskListFilters } from "@/lib/tasks/filters";
import { createTask } from "../../fixtures/tasks";

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/app-header", () => ({
  AppHeader: ({ actions }: { actions?: ReactNode }) => <>{actions}</>,
}));

vi.mock("@/app/tasks/[id]/_components/task-detail-client", () => ({
  TaskDetail: ({ onCreateDiscard }: { onCreateDiscard?: () => void }) => (
    <button onClick={onCreateDiscard} type="button">
      Discard draft
    </button>
  ),
}));

vi.mock("@/components/date-label", () => ({
  DateLabel: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock("@/components/project-image", () => ({
  ProjectImage: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/themes/theme-toggle", () => ({
  ThemeToggle: () => null,
}));

vi.mock("@/components/user-avatar", () => ({
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));

describe("TaskTable", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    window.history.replaceState({}, "", "/tasks");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("persists the debounced search query to the URL", async () => {
    render(
      <TaskTable
        activeProjectCount={1}
        error={null}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={{
          ...getDefaultTaskListFilters(),
          assignee: "me",
        }}
        items={[createTask()]}
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search work items"), {
      target: { value: "deploy" },
    });

    expect(replaceMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/tasks?q=deploy&assignee=me");
    }, {
      timeout: 1000,
    });
  });

  it("renders task load errors with the shared alert component", () => {
    render(
      <TaskTable
        activeProjectCount={1}
        error={{
          ...createPublicAzureDevOpsError("server"),
          message: "Failed to load work items.",
        }}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={getDefaultTaskListFilters()}
        items={[]}
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load work items.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("uses compact labels for long active path filters", () => {
    const areaPath = "Project\\Area\\Platform\\Backend";
    const iterationPath = "Project\\Release\\May\\Sprint 3";

    render(
      <TaskTable
        activeProjectCount={1}
        error={null}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={{
          ...getDefaultTaskListFilters(),
          areaPath,
          iterationPath,
        }}
        items={[createTask()]}
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    expect(screen.getByText("Area: Project / ... / Platform / Backend"))
      .toBeInTheDocument();
    expect(screen.getByText("Iteration: Project / ... / May / Sprint 3"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: `Remove area filter: ${areaPath}`,
    })).toHaveAttribute("title", areaPath);
    expect(screen.getByRole("button", {
      name: `Remove iteration filter: ${iterationPath}`,
    })).toHaveAttribute("title", iterationPath);
  });

  it("renders assignee lookup errors with the shared alert component", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Failed to load assignees." }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    )));

    render(
      <TaskTable
        activeProjectCount={1}
        error={null}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={getDefaultTaskListFilters()}
        items={[createTask()]}
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assignee" }));
    fireEvent.change(screen.getByPlaceholderText("Search assignee"), {
      target: { value: "ada" },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load assignees.",
      );
    });
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("consumes a command-center new-item request across draft remounts", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({
        item: {
          areas: [],
          defaultAreaPath: null,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    )));
    window.history.replaceState(
      {},
      "",
      "/tasks?newWorkItem=command-request&state=Active",
    );

    render(
      <TaskTable
        activeProjectCount={1}
        error={null}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={{
          ...getDefaultTaskListFilters(),
          states: ["Active"],
        }}
        items={[createTask()]}
        newWorkItemRequestKey="command-request"
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    expect(await screen.findByRole("dialog", { name: "New Work Item" }))
      .toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith(
      "/tasks?state=Active",
      { scroll: false },
    );

    fireEvent.change(screen.getByPlaceholderText("Work item title"), {
      target: { value: "Command-created work item" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Work item title").closest("form")!);

    fireEvent.click(await screen.findByRole("button", { name: "Discard draft" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New Work Item" }))
        .not.toBeInTheDocument();
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it("labels assignee lookup loading states", async () => {
    vi.stubGlobal("ResizeObserver", class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    render(
      <TaskTable
        activeProjectCount={1}
        error={null}
        filterOptions={{
          assignees: [],
          priorities: [],
          states: [],
          types: [],
        }}
        filters={getDefaultTaskListFilters()}
        items={[createTask()]}
        projects={[{ defaultTeamImageUrl: null, id: "project-id", name: "Project" }]}
        title="Work Items"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Assignee" }));
    fireEvent.change(screen.getByPlaceholderText("Search assignee"), {
      target: { value: "ada" },
    });

    await waitFor(() => {
      expect(screen.getByText("Loading assignees...")).toBeInTheDocument();
    });
  });
});
