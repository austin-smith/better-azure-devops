// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { WorkItemTypeLabel } from "@/components/tasks/work-item-type-label";

describe("WorkItemTypeLabel", () => {
  it("renders the normalized work item type label", () => {
    const { container } = render(<WorkItemTypeLabel type=" feature " />);

    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders unknown work item types without dropping the label", () => {
    render(<WorkItemTypeLabel type="Migration" />);

    expect(screen.getByText("Migration")).toBeInTheDocument();
  });
});
