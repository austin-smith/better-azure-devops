// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CommandCenterProvider,
} from "@/components/command-center/command-center";
import { CommandCenterTrigger } from "@/components/command-center/command-center-trigger";
import { ThemeProvider } from "@/components/themes/theme-provider";

const { navigationState, pushMock, refreshMock, replaceMock } = vi.hoisted(() => ({
  navigationState: {
    pathname: "/",
    searchParams: new URLSearchParams(),
  },
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => navigationState.searchParams,
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

function stubBrowserObservers() {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    addEventListener: vi.fn(),
    matches: false,
    media: "",
    onchange: null,
    removeEventListener: vi.fn(),
  })));
  vi.stubGlobal("ResizeObserver", class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}

function renderCommandCenter({
  analyticsEnabled = true,
  availableProjects = [
    {
      defaultTeamImageUrl: null,
      id: "project-one",
      name: "Project One",
    },
  ],
  selectedProjectIds = ["project-one"],
}: {
  analyticsEnabled?: boolean;
  availableProjects?: {
    defaultTeamImageUrl: string | null;
    id: string;
    name: string;
  }[];
  selectedProjectIds?: string[];
} = {}) {
  return render(
    <ThemeProvider initialResolvedTheme="light" initialTheme="system">
      <CommandCenterProvider
        analyticsEnabled={analyticsEnabled}
        availableProjects={availableProjects}
        selectedProjectIds={selectedProjectIds}
      >
        <CommandCenterTrigger />
      </CommandCenterProvider>
    </ThemeProvider>,
  );
}

describe("CommandCenter", () => {
  beforeEach(() => {
    navigationState.pathname = "/";
    navigationState.searchParams = new URLSearchParams();
    pushMock.mockReset();
    refreshMock.mockReset();
    replaceMock.mockReset();
    stubBrowserObservers();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens from Cmd/Ctrl+K, focuses search, and closes with Escape", async () => {
    renderCommandCenter();

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const dialog = await screen.findByRole("dialog", {
      name: "Command center",
    });
    const search = screen.getByRole("combobox", {
      name: "Search commands",
    });

    expect(dialog).toBeInTheDocument();
    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Command center" }))
        .not.toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Command center" }))
      .toBeInTheDocument();
  });

  it("adds version-aware destinations for the current repository", async () => {
    navigationState.pathname = "/repos/project-id/repository-id/blob/README.md";
    navigationState.searchParams = new URLSearchParams({
      version: "feature/repository-explorer",
      versionType: "branch",
    });

    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    expect(
      await screen.findByRole("option", {
        name: /^Repository code\./,
      }),
    ).toHaveAttribute("aria-label", expect.stringContaining("Current"));

    fireEvent.click(
      screen.getByRole("option", {
        name: /^Repository push activity\./,
      }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/repos/project-id/repository-id/activity?version=feature%2Frepository-explorer&versionType=branch",
    );
  });

  it("hides repository analytics when the feature is disabled", async () => {
    navigationState.pathname = "/repos/project-id/repository-id";

    renderCommandCenter({ analyticsEnabled: false });
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    await screen.findByRole("option", { name: /^Repository code\./ });
    expect(
      screen.queryByRole("option", { name: /^Repository analytics\./ }),
    ).not.toBeInTheDocument();
  });

  it("leaves handled Cmd/Ctrl+K events with the focused control", () => {
    renderCommandCenter();
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "k",
      metaKey: true,
    });

    event.preventDefault();
    document.dispatchEvent(event);

    expect(screen.queryByRole("dialog", { name: "Command center" }))
      .not.toBeInTheDocument();
  });

  it("resets a searched drill-in when the shortcut closes the dialog", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));
    fireEvent.click(await screen.findByRole("option", {
      name: /Browse filters/,
    }));
    fireEvent.change(screen.getByRole("combobox", {
      name: "Search filters",
    }), {
      target: { value: "bugs" },
    });

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Command center" }))
        .not.toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: "k", metaKey: true });

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    expect(search).toHaveValue("");
    expect(screen.getByRole("option", { name: /Browse filters/ }))
      .toBeInTheDocument();
  });

  it("filters grouped actions as the user searches", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    fireEvent.change(
      await screen.findByRole("combobox", { name: "Search commands" }),
      { target: { value: "bugs" } },
    );

    const filters = await screen.findByRole("option", {
      name: /Browse filters/,
    });
    expect(filters)
      .toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^All work itemsBrowse/ }))
      .not.toBeInTheDocument();

    fireEvent.click(filters);
    expect(await screen.findByRole("option", { name: /^Bugs\./ }))
      .toBeInTheDocument();
  });

  it("finds the project drill-in by an available project name", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(search, { target: { value: "Project One" } });

    const projects = await screen.findByRole("option", {
      name: /Switch active projects/,
    });
    fireEvent.click(projects);

    expect(await screen.findByRole("option", { name: /^Project One\./ }))
      .toBeInTheDocument();
  });

  it("keeps the root compact and opens secondary command modes", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    expect(await screen.findByRole("option", { name: /Browse filters/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Switch active projects/ }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Change appearance/ }))
      .toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Light mode\./ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Bugs\./ }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Project One\./ }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("listbox"))
      .toHaveClass("h-[min(60svh,24rem)]");
  });

  it.each([
    {
      allWorkItemsCurrent: true,
      label: "the unfiltered work-item list",
      search: "",
      yourQueueCurrent: false,
    },
    {
      allWorkItemsCurrent: false,
      label: "your queue",
      search: "assignee=me",
      yourQueueCurrent: true,
    },
    {
      allWorkItemsCurrent: false,
      label: "another filtered work-item list",
      search: "state=Active",
      yourQueueCurrent: false,
    },
  ])("marks only $label as current", async ({
    allWorkItemsCurrent,
    search,
    yourQueueCurrent,
  }) => {
    navigationState.pathname = "/tasks";
    navigationState.searchParams = new URLSearchParams(search);
    window.history.replaceState(
      {},
      "",
      search ? `/tasks?${search}` : "/tasks",
    );

    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const allWorkItems = await screen.findByRole("option", {
      name: /^All work items\./,
    });
    const yourQueue = screen.getByRole("option", {
      name: /^Your Queue\./,
    });

    expect(allWorkItems.getAttribute("aria-label")?.endsWith(". Current"))
      .toBe(allWorkItemsCurrent);
    expect(yourQueue.getAttribute("aria-label")?.endsWith(". Current"))
      .toBe(yourQueueCurrent);
  });

  it("enters the highlighted drill-in with ArrowRight", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    const filters = screen.getByRole("option", { name: /Browse filters/ });

    for (let index = 0; index < 5; index += 1) {
      fireEvent.keyDown(search, { key: "ArrowDown" });
    }

    expect(filters).toHaveAttribute("data-selected", "true");
    fireEvent.keyDown(search, { key: "ArrowRight" });

    const filterSearch = screen.getByRole("combobox", {
      name: "Search filters",
    });
    expect(filterSearch).toHaveFocus();

    fireEvent.keyDown(filterSearch, { key: "ArrowLeft" });
    const rootSearch = screen.getByRole("combobox", {
      name: "Search commands",
    });
    expect(screen.getByRole("option", { name: /Browse filters/ }))
      .toHaveAttribute("data-selected", "true");

    fireEvent.keyDown(rootSearch, { key: "ArrowRight" });
    expect(screen.getByRole("combobox", { name: "Search filters" }))
      .toHaveFocus();

    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Search filters" }),
      { key: "ArrowLeft" },
    );
    const restoredRootSearch = screen.getByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(restoredRootSearch, { target: { value: "browse" } });
    fireEvent.keyDown(restoredRootSearch, { key: "ArrowRight" });

    expect(screen.getByRole("combobox", { name: "Search commands" }))
      .toBeInTheDocument();
  });

  it("cycles modes and returns with ArrowLeft without hijacking text editing", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const rootSearch = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.keyDown(rootSearch, { key: "Tab" });
    const filterSearch = screen.getByRole("combobox", {
      name: "Search filters",
    });
    expect(filterSearch).toHaveFocus();

    fireEvent.keyDown(filterSearch, { key: "Tab" });
    const projectSearch = screen.getByRole("combobox", {
      name: "Search active projects",
    });
    expect(projectSearch).toHaveFocus();

    fireEvent.keyDown(projectSearch, { key: "Tab" });

    const appearanceSearch = screen.getByRole("combobox", {
      name: "Search appearance",
    });
    expect(appearanceSearch).toHaveFocus();
    expect(screen.getByRole("button", { name: "Back to commands" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Light mode\./ }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Default style\./ }))
      .toBeInTheDocument();

    fireEvent.change(appearanceSearch, { target: { value: "mono" } });
    expect(screen.getByRole("option", { name: /^Mono style\./ }))
      .toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: /^Default style\./ }))
        .not.toBeInTheDocument();
    });

    fireEvent.keyDown(appearanceSearch, { key: "Backspace" });

    expect(screen.getByRole("combobox", { name: "Search appearance" }))
      .toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();

    fireEvent.keyDown(appearanceSearch, { key: "ArrowLeft" });
    expect(screen.getByRole("combobox", { name: "Search appearance" }))
      .toBeInTheDocument();

    fireEvent.change(appearanceSearch, { target: { value: "" } });
    fireEvent.keyDown(appearanceSearch, { key: "ArrowLeft" });
    const commandsSearch = screen.getByRole("combobox", {
      name: "Search commands",
    });
    expect(commandsSearch).toHaveFocus();
    expect(commandsSearch).toHaveValue("");
    expect(screen.getByRole("option", { name: /Change appearance/ }))
      .toHaveAttribute("data-selected", "true");

    fireEvent.keyDown(commandsSearch, { key: "Tab", shiftKey: true });
    const reverseAppearanceSearch = screen.getByRole("combobox", {
      name: "Search appearance",
    });
    expect(reverseAppearanceSearch).toHaveFocus();

    fireEvent.keyDown(reverseAppearanceSearch, { key: "Tab" });
    expect(screen.getByRole("combobox", { name: "Search commands" }))
      .toHaveFocus();

    fireEvent.keyDown(
      screen.getByRole("combobox", { name: "Search commands" }),
      { key: "Tab", shiftKey: true },
    );
    fireEvent.click(screen.getByRole("button", { name: "Back to commands" }));
    expect(screen.getByRole("combobox", { name: "Search commands" }))
      .toHaveFocus();
  });

  it("skips project mode when no projects are available", async () => {
    renderCommandCenter({
      availableProjects: [],
      selectedProjectIds: [],
    });
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const rootSearch = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.keyDown(rootSearch, { key: "Tab" });
    const filterSearch = screen.getByRole("combobox", {
      name: "Search filters",
    });
    fireEvent.keyDown(filterSearch, { key: "Tab" });

    expect(screen.getByRole("combobox", { name: "Search appearance" }))
      .toHaveFocus();
    expect(screen.queryByRole("combobox", { name: "Search active projects" }))
      .not.toBeInTheDocument();
  });

  it("finds a secondary mode from root search and applies settings in place", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(search, { target: { value: "mono" } });
    fireEvent.click(await screen.findByRole("option", {
      name: /Change appearance/,
    }));

    fireEvent.change(screen.getByRole("combobox", {
      name: "Search appearance",
    }), { target: { value: "mono" } });
    fireEvent.click(await screen.findByRole("option", {
      name: /^Mono style\./,
    }));

    expect(screen.getByRole("dialog", { name: "Command center" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", {
      name: /^Mono style\..*Current$/,
    })).toBeInTheDocument();
  });

  it("runs the selected result with the keyboard", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(search, { target: { value: "highest priority" } });
    fireEvent.keyDown(search, { key: "Enter" });
    const filterSearch = await screen.findByRole("combobox", {
      name: "Search filters",
    });
    fireEvent.change(filterSearch, {
      target: { value: "highest priority" },
    });
    fireEvent.keyDown(filterSearch, { key: "Enter" });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/tasks?priority=1");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const reopenedSearch = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    expect(reopenedSearch).toHaveValue("");
    expect(screen.getByRole("option", { name: /Browse filters/ }))
      .toBeInTheDocument();
  });

  it("navigates directly to a numeric work item ID", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    const search = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(search, { target: { value: "#1234" } });
    fireEvent.click(await screen.findByRole("option", {
      name: /Open work item #1234/,
    }));

    expect(pushMock).toHaveBeenCalledWith("/tasks/1234");
  });

  it("routes global new-item requests into the existing creation flow", async () => {
    vi.spyOn(Date, "now").mockReturnValue(123456);
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));

    fireEvent.click(await screen.findByRole("option", {
      name: /New Work Item/,
    }));

    expect(pushMock).toHaveBeenCalledWith("/tasks?newWorkItem=123456");
  });

  it("updates active projects and clears project-scoped task filters", async () => {
    navigationState.pathname = "/tasks";
    window.history.replaceState(
      {},
      "",
      "/tasks?areaPath=Project%5CArea&iterationPath=Project%5CSprint&project=project-one&state=Active",
    );
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({
        availableProjects: [
          {
            defaultTeamImageUrl: null,
            id: "project-one",
            name: "Project One",
          },
        ],
        selectedProjectIds: [],
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    ));
    vi.stubGlobal("fetch", fetchMock);
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));
    fireEvent.click(await screen.findByRole("option", {
      name: /Switch active projects/,
    }));

    fireEvent.click(await screen.findByRole("option", {
      name: /^Project One\./,
    }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/projects/selection",
        expect.objectContaining({
          body: JSON.stringify({ projectIds: [] }),
          method: "PATCH",
        }),
      );
    });
    expect(replaceMock).toHaveBeenCalledWith("/tasks?state=Active");
    expect(refreshMock).toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Command center" }))
      .toBeInTheDocument();
  });

  it("opens direct work item IDs from a secondary view", async () => {
    renderCommandCenter();
    fireEvent.click(screen.getByRole("button", { name: "Open command center" }));
    fireEvent.click(await screen.findByRole("option", {
      name: /Browse filters/,
    }));

    const search = screen.getByRole("combobox", {
      name: "Search filters",
    });
    fireEvent.change(search, { target: { value: "23056" } });
    fireEvent.click(await screen.findByRole("option", {
      name: /^Open work item #23056\./,
    }));

    expect(pushMock).toHaveBeenCalledWith("/tasks/23056");
  });

  it("exposes an accessible trigger, dialog description, and shortcut help", async () => {
    renderCommandCenter();

    const trigger = screen.getByRole("button", {
      name: "Open command center",
    });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Command center",
    });
    expect(dialog).toHaveAccessibleDescription(
      "Search navigation, work items, projects, filters, and appearance.",
    );
    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Switch")).toBeInTheDocument();

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByText("Back")).not.toBeInTheDocument();
  });
});
