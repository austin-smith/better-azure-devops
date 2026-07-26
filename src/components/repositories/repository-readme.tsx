import { RepositoryMarkdown } from "@/components/repositories/repository-markdown";
import { RepositoryPathIcon } from "@/components/repositories/repository-path-icon";
import type {
  AzureGitItem,
  GitVersionDescriptor,
} from "@/lib/azure-devops/git/types";

export function RepositoryReadme({
  item,
  projectId,
  repositoryId,
  version,
}: {
  item: AzureGitItem;
  projectId: string;
  repositoryId: string;
  version: GitVersionDescriptor;
}) {
  if (item.content === null) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium">
        <RepositoryPathIcon kind="file" path={item.path} />
        {item.path.split("/").pop() ?? "README"}
      </header>
      <RepositoryMarkdown
        content={item.content}
        path={item.path}
        projectId={projectId}
        repositoryId={repositoryId}
        version={version}
      />
    </section>
  );
}
