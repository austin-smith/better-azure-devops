// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TaskTable } from "@/components/tasks/task-table";
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
  AppHeader: () => null,
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
});
