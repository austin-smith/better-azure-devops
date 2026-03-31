// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { TaskComments } from "@/app/tasks/[id]/_components/task-comments";
import type { AzureDevOpsTaskDetail } from "@/lib/azure-devops/tasks";

vi.mock("@/components/date-label", () => ({
  DateLabel: ({ value }: { value: string }) => <span>{value}</span>,
}));

vi.mock("@/components/tasks/task-markup", () => ({
  TaskMarkup: ({
    html,
    markdown,
    text,
  }: {
    html?: string;
    markdown?: string;
    text?: string;
  }) => <div>{html ?? markdown ?? text ?? null}</div>,
}));

vi.mock("@/components/user-avatar", () => ({
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    render,
  }: {
    children: ReactNode;
    render: ReactElement;
  }) => cloneElement(render, {}, children),
}));

vi.mock("@/app/tasks/[id]/_components/task-detail-section-label", () => ({
  TaskDetailSectionLabel: ({
    count,
    title,
  }: {
    count: number;
    title: string;
  }) => (
    <div>
      {title} ({count})
    </div>
  ),
}));

describe("TaskComments", () => {
  it("renders reactions for comments when present", () => {
    const comments: AzureDevOpsTaskDetail["comments"] = [
      {
        authorAvatarUrl: null,
        authorName: "Grace Hopper",
        createdAt: "2025-01-05T13:00:00.000Z",
        format: "markdown",
        html: "",
        id: 1,
        reactions: [
          {
            count: 3,
            isCurrentUserEngaged: true,
            type: "like",
            users: [
              {
                avatarUrl: null,
                name: "Aleksandar Puskas",
              },
              {
                avatarUrl: null,
                name: "Ada Lovelace",
              },
              {
                avatarUrl: null,
                name: "Grace Hopper",
              },
            ],
          },
          {
            count: 1,
            isCurrentUserEngaged: false,
            type: "heart",
            users: [
              {
                avatarUrl: null,
                name: "Barbara Liskov",
              },
            ],
          },
        ],
        text: "Ping team",
      },
    ];

    render(<TaskComments comments={comments} />);

    expect(screen.getByText("Discussion (1)")).toBeInTheDocument();
    expect(screen.getByLabelText("Like: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Heart: 1")).toBeInTheDocument();
    expect(screen.getByText("Liked by 3 users")).toBeInTheDocument();
    expect(screen.getByText("Aleksandar Puskas")).toBeInTheDocument();
    expect(screen.getByText("Loved by 1 user")).toBeInTheDocument();
    expect(screen.getByText("Barbara Liskov")).toBeInTheDocument();
  });

  it("does not render reaction badges when a comment has no reactions", () => {
    const comments: AzureDevOpsTaskDetail["comments"] = [
      {
        authorAvatarUrl: null,
        authorName: "Grace Hopper",
        createdAt: "2025-01-05T13:00:00.000Z",
        format: "markdown",
        html: "",
        id: 1,
        reactions: [],
        text: "Ping team",
      },
    ];

    render(<TaskComments comments={comments} />);

    expect(screen.queryByLabelText(/Like:/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Heart:/)).not.toBeInTheDocument();
  });
});
