import Link from "next/link";
import {
  AlertCircleIcon,
  FolderGit2Icon,
  KeyRoundIcon,
  SearchXIcon,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AzureDevOpsErrorDescriptor } from "@/lib/azure-devops/errors";

export function RepositoryErrorAlert({
  error,
}: {
  error: AzureDevOpsErrorDescriptor;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>
        {error.kind === "throttled"
          ? "Azure DevOps is busy"
          : "Repository data is unavailable"}
      </AlertTitle>
      <AlertDescription>
        {error.message}
        {error.retryAfterSeconds !== null
          ? ` Retry after ${error.retryAfterSeconds} seconds.`
          : ""}
        {error.correlationId
          ? ` Correlation ID: ${error.correlationId}.`
          : ""}
      </AlertDescription>
    </Alert>
  );
}

export function NoProjectsState() {
  return (
    <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <KeyRoundIcon />
        </EmptyMedia>
        <EmptyTitle>Select a project to explore code</EmptyTitle>
        <EmptyDescription>
          Use the project control in the sidebar to choose one or more Azure
          DevOps projects.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function NoRepositoriesState() {
  return (
    <Empty className="min-h-80 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderGit2Icon />
        </EmptyMedia>
        <EmptyTitle>No Git repositories found</EmptyTitle>
        <EmptyDescription>
          The selected projects do not contain a readable Git repository.
          TFVC projects are not shown in this explorer.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function NoRepositoryMatchesState({
  onClear,
}: {
  onClear: () => void;
}) {
  return (
    <Empty className="min-h-64 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>No repositories match</EmptyTitle>
        <EmptyDescription>
          Try another name or clear the current filters.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </EmptyContent>
    </Empty>
  );
}

export function EmptyRepositoryState({
  webUrl,
}: {
  webUrl: string | null;
}) {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderGit2Icon />
        </EmptyMedia>
        <EmptyTitle>This repository has no default branch</EmptyTitle>
        <EmptyDescription>
          Initialize it in Azure DevOps before browsing files and history here.
        </EmptyDescription>
      </EmptyHeader>
      {webUrl ? (
        <EmptyContent>
          <Button
            nativeButton={false}
            variant="outline"
            render={
              <Link href={webUrl} rel="noreferrer" target="_blank" />
            }
          >
            Open in Azure DevOps
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}

export function EmptyRepositoryPageState({
  webUrl,
}: {
  webUrl: string | null;
}) {
  return (
    <div className="p-4 md:p-6">
      <EmptyRepositoryState webUrl={webUrl} />
    </div>
  );
}
