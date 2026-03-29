// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { PriorityBadge } from "@/components/tasks/priority-badge";

describe("PriorityBadge", () => {
  it("renders the priority label", () => {
    render(<PriorityBadge priority="1" />);

    expect(screen.getByText("P1")).toBeInTheDocument();
  });

  it("falls back to an unknown label for empty priorities", () => {
    render(<PriorityBadge priority=" " />);

    expect(screen.getByText("P?")).toBeInTheDocument();
  });
});
