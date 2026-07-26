import { RepositoryFileList } from "@/components/repositories/repository-file-list";
import type {
  AzureGitCommitSummary,
  AzureGitItem,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";

export function RepositoryDirectory({
  items,
  latestCommit,
  path,
  projectId,
  repositoryId,
  version,
  children,
}: {
  children?: React.ReactNode;
  items: AzureGitItem[];
  latestCommit: AzureGitCommitSummary | null;
  path: string;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-4">
      <RepositoryFileList
        items={items}
        latestCommit={latestCommit}
        path={path}
        projectId={projectId}
        repositoryId={repositoryId}
        version={version}
      />
      {children}
    </div>
  );
}
