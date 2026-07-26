"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BracesIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  Clock3Icon,
  Code2Icon,
  GitBranchIcon,
  GitPullRequestArrowIcon,
  SearchIcon,
  TagsIcon,
  UploadIcon,
} from "lucide-react";
import { RepositoryTabNav } from "@/components/repositories/repository-tab-nav";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  AzureGitRef,
  GitVersionDescriptor,
  GitVersionType,
} from "@/lib/azure-devops/git/types";
import {
  getRepositoryHref,
  stripRefPrefix,
} from "@/lib/azure-devops/git/urls";
import type { RepositoryPullRequestCount } from "@/lib/repositories/loaders";

type RepositoryToolbarProps = {
  branches: AzureGitRef[];
  branchesTruncated: boolean;
  defaultBranch: string;
  projectId: string;
  pullRequestCount: RepositoryPullRequestCount | null;
  repositoryId: string;
  tags: AzureGitRef[];
  tagsTruncated: boolean;
};

type NavigationItem = {
  href: string;
  icon: typeof Code2Icon;
  isActive: (pathname: string, repositoryRoot: string) => boolean;
  label: string;
};

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    href: "",
    icon: Code2Icon,
    isActive: (pathname, root) =>
      pathname === root ||
      pathname.startsWith(`${root}/tree`) ||
      pathname.startsWith(`${root}/blob`),
    label: "Code",
  },
  {
    href: "/commits",
    icon: Clock3Icon,
    isActive: (pathname, root) => pathname.startsWith(`${root}/commits`),
    label: "Commits",
  },
  {
    href: "/pulls",
    icon: GitPullRequestArrowIcon,
    isActive: (pathname, root) => pathname.startsWith(`${root}/pulls`),
    label: "Pull requests",
  },
  {
    href: "/activity",
    icon: UploadIcon,
    isActive: (pathname, root) => pathname.startsWith(`${root}/activity`),
    label: "Activity",
  },
  {
    href: "/search",
    icon: SearchIcon,
    isActive: (pathname, root) => pathname.startsWith(`${root}/search`),
    label: "Search",
  },
];

const VERSION_ICONS = {
  branch: GitBranchIcon,
  commit: BracesIcon,
  tag: TagsIcon,
} as const;

function getSelectedVersion(
  searchParams: URLSearchParams,
  defaultBranch: string,
): GitVersionDescriptor {
  const rawType = searchParams.get("versionType");
  const type: GitVersionType =
    rawType === "commit" || rawType === "tag" ? rawType : "branch";

  return {
    type,
    value: searchParams.get("version")?.trim() || stripRefPrefix(defaultBranch),
  };
}

function VersionSelector({
  branches,
  branchesTruncated,
  defaultBranch,
  tags,
  tagsTruncated,
}: Pick<
  RepositoryToolbarProps,
  "branches" | "branchesTruncated" | "defaultBranch" | "tags" | "tagsTruncated"
>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const selected = getSelectedVersion(searchParams, defaultBranch);
  const SelectedIcon = VERSION_ICONS[selected.type];

  function selectVersion(type: GitVersionType, value: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    nextSearchParams.set("versionType", type);
    nextSearchParams.set("version", value);
    nextSearchParams.delete("cursor");
    setOpen(false);
    router.push(`${pathname}?${nextSearchParams}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            className="max-w-56 justify-between font-mono"
            size="sm"
            variant="outline"
          />
        }
      >
        <SelectedIcon data-icon="inline-start" />
        <span className="truncate">{selected.value}</span>
        <ChevronsUpDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="sr-only">
          <PopoverTitle>Switch version</PopoverTitle>
          <PopoverDescription>
            Choose a branch or tag to browse.
          </PopoverDescription>
        </PopoverHeader>
        <Command>
          <CommandInput placeholder="Find a branch or tag" />
          <CommandList className="max-h-80">
            <CommandEmpty>No matching branch or tag.</CommandEmpty>
            <CommandGroup heading="Branches">
              {branches.map((branch) => {
                const value = stripRefPrefix(branch.name);
                const checked =
                  selected.type === "branch" && selected.value === value;

                return (
                  <CommandItem
                    data-checked={checked}
                    key={branch.name}
                    onSelect={() => {
                      selectVersion("branch", value);
                    }}
                    value={`branch ${value}`}
                  >
                    <GitBranchIcon />
                    <span className="truncate font-mono text-xs">{value}</span>
                    {branch.name === defaultBranch ? (
                      <span className="ml-auto text-xs text-muted-foreground">
                        default
                      </span>
                    ) : null}
                    {checked ? <CheckIcon className="sr-only" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {tags.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tags">
                  {tags.map((tag) => {
                    const value = stripRefPrefix(tag.name);

                    return (
                      <CommandItem
                        data-checked={
                          selected.type === "tag" && selected.value === value
                        }
                        key={tag.name}
                        onSelect={() => {
                          selectVersion("tag", value);
                        }}
                        value={`tag ${value}`}
                      >
                        <TagsIcon />
                        <span className="truncate font-mono text-xs">
                          {value}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
        {branchesTruncated || tagsTruncated ? (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Showing the first available{" "}
            {branchesTruncated && tagsTruncated
              ? "branches and tags"
              : branchesTruncated
                ? "branches"
                : "tags"}
            . Open Azure DevOps to browse the complete ref list.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function RepositoryToolbar({
  branches,
  branchesTruncated,
  defaultBranch,
  projectId,
  pullRequestCount,
  repositoryId,
  tags,
  tagsTruncated,
}: RepositoryToolbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const repositoryRoot = getRepositoryHref(projectId, repositoryId);
  const version = getSelectedVersion(searchParams, defaultBranch);
  const versionParams = useMemo(
    () =>
      new URLSearchParams({
        version: version.value,
        versionType: version.type,
      }).toString(),
    [version.type, version.value],
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b px-3">
      <RepositoryTabNav
        ariaLabel="Repository"
        className="h-full flex-1"
        items={NAVIGATION_ITEMS.map((item) => ({
          active: item.isActive(pathname, repositoryRoot),
          count:
            item.href === "/pulls" && pullRequestCount
              ? pullRequestCount.isCapped
                ? `${pullRequestCount.value}+`
                : pullRequestCount.value
              : null,
          href: `${repositoryRoot}${item.href}?${versionParams}`,
          icon: item.icon,
          label: item.label,
        }))}
      />
      <VersionSelector
        branches={branches}
        branchesTruncated={branchesTruncated}
        defaultBranch={defaultBranch}
        tags={tags}
        tagsTruncated={tagsTruncated}
      />
    </div>
  );
}
