// @vitest-environment jsdom

import { cloneElement, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "@/components/app-header";

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button className={className} type="button">
      Toggle sidebar
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ render }: { render: ReactElement }) =>
    cloneElement(render),
}));

describe("AppHeader", () => {
  it("owns the sidebar trigger tooltip and shortcut hint", () => {
    render(<AppHeader items={[{ label: "Tasks" }]} />);

    expect(screen.getByRole("button", { name: "Toggle sidebar" }))
      .toHaveClass("-ml-1");
    expect(screen.getAllByText("Toggle sidebar")).toHaveLength(2);
    expect(screen.getByText("B").closest('[data-slot="kbd-group"]'))
      .toBeInTheDocument();
  });
});
