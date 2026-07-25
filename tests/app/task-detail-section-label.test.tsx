// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { TaskDetailSectionLabel } from "@/app/tasks/[id]/_components/task-detail-section-label";

describe("TaskDetailSectionLabel", () => {
  it("keeps the title and trailing action separated in constrained layouts", () => {
    render(
      <TaskDetailSectionLabel
        action={<button type="button">Edit</button>}
        title="Description"
      />,
    );

    const title = screen.getByRole("heading", { name: "Description" });
    const action = screen.getByRole("button", { name: "Edit" });
    const row = title.parentElement;
    const trailing = action.parentElement;

    expect(row).toHaveClass("min-w-0", "gap-2");
    expect(title).toHaveClass("min-w-0");
    expect(trailing).toHaveClass("shrink-0");
  });

  it("renders section counts with tabular alignment", () => {
    render(<TaskDetailSectionLabel count={12} title="Discussion" />);

    expect(screen.getByText("12")).toHaveClass("tabular-nums");
  });
});
