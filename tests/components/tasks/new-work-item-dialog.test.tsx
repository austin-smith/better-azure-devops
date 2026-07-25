// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewWorkItemDialog } from "@/components/tasks/new-work-item-dialog";

const project = {
  defaultTeamImageUrl: null,
  id: "project-id",
  name: "Project",
};

function stubResizeObserver() {
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
}

describe("NewWorkItemDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders validation errors with the shared alert component", () => {
    stubResizeObserver();
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

    render(
      <NewWorkItemDialog
        onContinue={vi.fn()}
        projects={[project]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Work Item" }));
    fireEvent.submit(screen.getByPlaceholderText("Work item title").closest("form")!);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Project, work item type, and title are required.",
    );
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("uses field labels without nesting interactive controls inside labels", async () => {
    stubResizeObserver();
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

    render(
      <NewWorkItemDialog
        onContinue={vi.fn()}
        projects={[project]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Work Item" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Title"))
        .toBe(screen.getByPlaceholderText("Work item title"));
    });
    expect(document.body.querySelectorAll('[data-slot="field"]')).toHaveLength(5);
    expect(document.body.querySelector("label button")).toBeNull();
  });

  it("renders area lookup errors with the shared alert component", async () => {
    stubResizeObserver();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: "Failed to load area settings." }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    )));

    render(
      <NewWorkItemDialog
        onContinue={vi.fn()}
        projects={[project]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Work Item" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Select area" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load area settings.",
      );
    });
    expect(screen.getByRole("alert")).toHaveAttribute("data-slot", "alert");
  });

  it("labels area loading states inside the open area list", async () => {
    stubResizeObserver();
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    render(
      <NewWorkItemDialog
        onContinue={vi.fn()}
        projects={[project]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New Work Item" }));
    fireEvent.click(screen.getByRole("button", { name: "Select area" }));

    await waitFor(() => {
      expect(screen.getAllByText("Loading areas...")).toHaveLength(2);
    });
  });
});
