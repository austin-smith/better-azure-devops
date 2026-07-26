import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { RepositoryList } from "@/components/repositories/repository-list";
import {
  NoProjectsState,
  NoRepositoriesState,
  RepositoryErrorAlert,
} from "@/components/repositories/repository-state";
import { ThemeToggle } from "@/components/themes/theme-toggle";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";
import { loadRepositoryListPage } from "@/lib/repositories/loaders";

export const metadata: Metadata = {
  title: "Repositories",
  description: "Browse Azure DevOps Git repositories",
};

export default async function RepositoriesPage() {
  if (!hasAzureDevOpsConfig()) {
    return (
      <>
        <RepositoriesHeader />
        <div className="p-3 md:p-4">
          <RepositoryErrorAlert
            error={{
              correlationId: null,
              kind: "not-configured",
              message:
                "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
              retryAfterSeconds: null,
              status: null,
            }}
          />
        </div>
      </>
    );
  }

  let data = null;
  let loadError = null;

  try {
    data = await loadRepositoryListPage();
  } catch (error) {
    loadError = describeAzureDevOpsError(error);
  }

  return (
    <>
      <RepositoriesHeader />

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
        {loadError ? <RepositoryErrorAlert error={loadError} /> : null}

        {data?.errors.map(({ error, project }) => (
          <RepositoryErrorAlert
            error={{
              ...error,
              message: `${project.name}: ${error.message}`,
            }}
            key={project.id}
          />
        ))}

        {data ? (
          data.projectCount === 0 ? (
            <NoProjectsState />
          ) : data.repositories.length === 0 ? (
            <NoRepositoriesState />
          ) : (
            <RepositoryList repositories={data.repositories} />
          )
        ) : null}
      </div>
    </>
  );
}

function RepositoriesHeader() {
  return (
    <AppHeader
      actions={<ThemeToggle />}
      items={[{ href: "/", label: "Home" }, { label: "Repositories" }]}
    />
  );
}
