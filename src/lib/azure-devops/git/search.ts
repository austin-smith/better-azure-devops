import { azureDevOpsRequest } from "@/lib/azure-devops/client";
import { getAzureDevOpsOrganizationName } from "@/lib/azure-devops/config";
import { parseSearchResults } from "@/lib/azure-devops/git/parsers";

export async function searchRepositoryCode(
  accessToken: string,
  projectId: string,
  projectName: string,
  repositoryId: string,
  repositoryName: string,
  options: {
    branch?: string | null;
    cursor?: string | null;
    path?: string | null;
    query: string;
    top?: number;
  },
) {
  const query = options.query.trim();

  if (!query) {
    return {
      infoCode: null,
      items: [],
      nextCursor: null,
      totalCount: 0,
    };
  }

  const skip = options.cursor ? Number(options.cursor) : 0;
  const safeSkip = Number.isSafeInteger(skip) && skip >= 0 ? skip : 0;
  const top = Math.min(Math.max(options.top ?? 25, 1), 100);
  const filters: Record<string, string[]> = {
    Project: [projectName],
    Repository: [repositoryName],
  };

  if (options.branch) {
    filters.Branch = [options.branch];
  }

  if (options.path) {
    filters.Path = [options.path];
  }

  const organization = getAzureDevOpsOrganizationName();
  const response = await azureDevOpsRequest<unknown>(
    "/_apis/search/codesearchresults?api-version=7.1",
    {
      accessToken,
      baseUrl: `https://almsearch.dev.azure.com/${encodeURIComponent(organization)}`,
      body: JSON.stringify({
        $skip: safeSkip,
        $top: top,
        filters,
        includeFacets: true,
        searchText: query,
      }),
      method: "POST",
    },
  );
  const { rawItemCount, ...result } = parseSearchResults(response);
  const nextSkip = safeSkip + rawItemCount;

  return {
    ...result,
    items: result.items.filter(
      (item) =>
        item.project.id === projectId &&
        item.repository.id === repositoryId,
    ),
    nextCursor:
      rawItemCount > 0 && nextSkip < result.totalCount
        ? String(nextSkip)
        : null,
  };
}
