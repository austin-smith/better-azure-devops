"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AzureDevOpsTeamAreaOption,
  AzureDevOpsTeamAreaSettings,
} from "@/lib/azure-devops/tasks";
import { WorkItemTypeLabel } from "@/components/tasks/work-item-type-label";
import { getCompactTaskPathBreadcrumb } from "@/lib/tasks/filters";
import { getDefaultWorkItemTypes } from "@/lib/tasks/work-item-type";

export type NewWorkItemProjectOption = {
  defaultTeamImageUrl: string | null;
  id: string;
  name: string;
};

export type NewWorkItemDraft = {
  areaPath: string;
  priority: string;
  project: NewWorkItemProjectOption;
  title: string;
  type: string;
};

type NewWorkItemDialogProps = {
  disabled?: boolean;
  onContinue: (draft: NewWorkItemDraft) => void;
  projects: readonly NewWorkItemProjectOption[];
};

const DEFAULT_WORK_ITEM_TYPES = getDefaultWorkItemTypes();
const DEFAULT_PRIORITY = "2";

function getInitialProjectId(projects: readonly NewWorkItemProjectOption[]) {
  return projects[0]?.id ?? "";
}

export function NewWorkItemDialog({
  disabled = false,
  onContinue,
  projects,
}: NewWorkItemDialogProps) {
  const [areaPath, setAreaPath] = useState("");
  const [areaOptions, setAreaOptions] = useState<AzureDevOpsTeamAreaOption[]>([]);
  const [areaError, setAreaError] = useState<string | null>(null);
  const [hasLoadedAreas, setHasLoadedAreas] = useState(false);
  const [isAreaOpen, setIsAreaOpen] = useState(false);
  const [isLoadingAreas, setIsLoadingAreas] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState(DEFAULT_PRIORITY);
  const [projectId, setProjectId] = useState(() => getInitialProjectId(projects));
  const [title, setTitle] = useState("");
  const [type, setType] = useState(DEFAULT_WORK_ITEM_TYPES[0] ?? "Task");
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
  );
  const isCreateDisabled = disabled || projects.length === 0;
  const selectedArea = areaOptions.find((option) => option.value === areaPath) ?? null;

  useEffect(() => {
    if (projectId && projects.some((project) => project.id === projectId)) {
      return;
    }

    setProjectId(getInitialProjectId(projects));
  }, [projectId, projects]);

  useEffect(() => {
    setAreaPath("");
    setAreaOptions([]);
    setAreaError(null);
    setHasLoadedAreas(false);
    setIsLoadingAreas(Boolean(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!isOpen || !projectId || hasLoadedAreas) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setIsLoadingAreas(true);
      setAreaError(null);

      try {
        const response = await fetch(
          `/api/projects/area-settings?project=${encodeURIComponent(projectId)}`,
          {
            signal: controller.signal,
          },
        );
        const payload = (await response.json()) as
          | {
              error?: string;
              item?: AzureDevOpsTeamAreaSettings;
            }
          | undefined;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Failed to load area settings.");
        }

        const settings = payload?.item ?? {
          areas: [],
          defaultAreaPath: null,
        };

        setAreaOptions(settings.areas);
        setAreaPath(settings.defaultAreaPath ?? "");
        setHasLoadedAreas(true);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        setAreaOptions([]);
        setAreaError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load area settings.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingAreas(false);
        }
      }
    })();

    return () => controller.abort();
  }, [hasLoadedAreas, isOpen, projectId]);

  function resetForm() {
    setAreaPath("");
    setAreaOptions([]);
    setAreaError(null);
    setHasLoadedAreas(false);
    setIsAreaOpen(false);
    setError(null);
    setPriority(DEFAULT_PRIORITY);
    setProjectId(getInitialProjectId(projects));
    setTitle("");
    setType(DEFAULT_WORK_ITEM_TYPES[0] ?? "Task");
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open);

    if (!open) {
      resetForm();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();

    if (!selectedProject || !projectId || !trimmedTitle || !type) {
      setError("Project, work item type, and title are required.");
      return;
    }

    onContinue({
      areaPath,
      priority: priority.trim() || DEFAULT_PRIORITY,
      project: selectedProject,
      title: trimmedTitle,
      type,
    });
    setIsOpen(false);
    resetForm();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        disabled={isCreateDisabled}
        render={<Button size="sm" />}
      >
        <PlusIcon data-icon="inline-start" />
        <span>New Work Item</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Work Item</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Project</span>
              <Select
                disabled={projects.length === 0}
                onValueChange={(value) => {
                  if (value) {
                    setProjectId(value);
                  }
                }}
                value={projectId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {selectedProject?.name ?? "Select project"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Area</span>
              <Popover
                modal={false}
                open={isAreaOpen}
                onOpenChange={setIsAreaOpen}
              >
                <PopoverTrigger
                  disabled={!projectId}
                  render={(
                    <Button
                      className="w-full justify-between"
                      type="button"
                      variant="outline"
                    />
                  )}
                >
                  {isLoadingAreas ? (
                    <span className="flex min-w-0 flex-1 items-center gap-2 font-normal text-muted-foreground">
                      <Loader2Icon className="size-4 animate-spin" />
                    </span>
                  ) : (
                    <>
                      <span className="min-w-0 truncate font-normal">
                        {selectedArea || areaPath
                          ? getCompactTaskPathBreadcrumb(selectedArea?.value ?? areaPath)
                          : "Select area"}
                      </span>
                      <ChevronDownIcon className="size-4" />
                    </>
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 overflow-hidden p-0">
                  <Command shouldFilter>
                    <CommandInput placeholder="Search areas" />
                    <CommandList className="max-h-72">
                      {isLoadingAreas ? (
                        <div className="flex items-center justify-center py-3 text-muted-foreground">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      ) : null}
                      {areaError ? (
                        <div className="px-3 py-2 text-xs text-destructive">{areaError}</div>
                      ) : null}
                      {!isLoadingAreas && !areaError ? (
                        <>
                          <CommandEmpty>No areas found.</CommandEmpty>
                          <CommandGroup>
                            {areaOptions.map((option) => (
                              <CommandItem
                                key={option.value}
                                onSelect={() => {
                                  setAreaPath(option.value);
                                  setIsAreaOpen(false);
                                }}
                                value={option.value}
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-foreground">
                                    {getCompactTaskPathBreadcrumb(option.value)}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground">
                                    {option.includeChildren
                                      ? "Includes subareas"
                                      : "Exact area"}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </>
                      ) : null}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <label className="grid gap-1.5 text-sm font-medium">
                <span>Type</span>
                <Select
                  onValueChange={(value) => {
                    if (value) {
                      setType(value);
                    }
                  }}
                  value={type}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <WorkItemTypeLabel type={type} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      {DEFAULT_WORK_ITEM_TYPES.map((workItemType) => (
                        <SelectItem key={workItemType} value={workItemType}>
                          <WorkItemTypeLabel type={workItemType} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                <span>Priority</span>
                <Select
                  onValueChange={(value) => {
                    if (value) {
                      setPriority(value);
                    }
                  }}
                  value={priority}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <PriorityBadge priority={priority} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      {["1", "2", "3", "4"].map((value) => (
                        <SelectItem key={value} value={value}>
                          <PriorityBadge priority={value} />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-medium">
              <span>Title</span>
              <Input
                autoFocus
                maxLength={255}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Work item title"
                required
                value={title}
              />
            </label>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!title.trim() || !projectId} type="submit">
              <ArrowRightIcon data-icon="inline-start" />
              Continue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
