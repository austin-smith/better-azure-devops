import type {
  GitVersionDescriptor,
  GitVersionType,
} from "@/lib/azure-devops/git/types";

const VERSION_TYPES = new Set<GitVersionType>(["branch", "commit", "tag"]);

export const DEFAULT_VERSION_TYPE: GitVersionType = "branch";

export function stripRefPrefix(value: string) {
  return value
    .replace(/^refs\/heads\//, "")
    .replace(/^refs\/tags\//, "");
}

export function normalizeRepositoryPath(value: string) {
  const normalized = value
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment && segment !== ".")
    .reduce<string[]>((segments, segment) => {
      if (segment === "..") {
        segments.pop();
      } else {
        segments.push(segment);
      }

      return segments;
    }, [])
    .join("/");

  return normalized ? `/${normalized}` : "/";
}

export function encodeRepositoryPath(path: string) {
  return normalizeRepositoryPath(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function parseGitVersionDescriptor(
  searchParams: Record<string, string | string[] | undefined>,
  defaultBranch: string | null,
): GitVersionDescriptor | null {
  const rawType = searchParams.versionType;
  const rawValue = searchParams.version;
  const type =
    typeof rawType === "string" && VERSION_TYPES.has(rawType as GitVersionType)
      ? (rawType as GitVersionType)
      : DEFAULT_VERSION_TYPE;
  const value =
    typeof rawValue === "string" && rawValue.trim()
      ? rawValue.trim()
      : defaultBranch
        ? stripRefPrefix(defaultBranch)
        : "";

  return value ? { type, value } : null;
}

export function getGitVersionRefName(version: GitVersionDescriptor) {
  if (version.type === "commit") {
    return null;
  }

  if (version.value.startsWith("refs/")) {
    return version.value;
  }

  const namespace = version.type === "tag" ? "tags" : "heads";

  return `refs/${namespace}/${version.value}`;
}

export function appendVersionSearchParams(
  searchParams: URLSearchParams,
  version: GitVersionDescriptor,
) {
  searchParams.set("versionType", version.type);
  searchParams.set("version", version.value);

  return searchParams;
}

export function getRepositoryHref(
  projectId: string,
  repositoryId: string,
) {
  return `/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}`;
}

export function getRepositoryTreeHref(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
) {
  const encodedPath = encodeRepositoryPath(path);
  const base = `${getRepositoryHref(projectId, repositoryId)}/tree`;
  const searchParams = appendVersionSearchParams(
    new URLSearchParams(),
    version,
  );

  return `${encodedPath ? `${base}/${encodedPath}` : base}?${searchParams}`;
}

export function getRepositoryBlobHref(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  line?: number,
) {
  const href = `${getRepositoryHref(projectId, repositoryId)}/blob/${encodeRepositoryPath(path)}?${appendVersionSearchParams(
    new URLSearchParams(),
    version,
  )}`;

  return line ? `${href}#L${line}` : href;
}

export function getRepositoryContentHref(
  projectId: string,
  repositoryId: string,
  path: string,
  version: GitVersionDescriptor,
  options: {
    download?: boolean;
  } = {},
) {
  const searchParams = appendVersionSearchParams(
    new URLSearchParams({
      path: normalizeRepositoryPath(path),
    }),
    version,
  );

  if (options.download) {
    searchParams.set("download", "true");
  }

  return `/api/repos/${encodeURIComponent(projectId)}/${encodeURIComponent(repositoryId)}/content?${searchParams}`;
}

export function getRepositoryCommitsHref(
  projectId: string,
  repositoryId: string,
  version: GitVersionDescriptor,
  path?: string,
) {
  const searchParams = appendVersionSearchParams(
    new URLSearchParams(),
    version,
  );

  if (path) {
    searchParams.set("path", normalizeRepositoryPath(path));
  }

  return `${getRepositoryHref(projectId, repositoryId)}/commits?${searchParams}`;
}

export type RepositoryHistoryContext = {
  cursor?: string | null;
  path?: string | null;
  version: GitVersionDescriptor;
};

function appendHistoryContextSearchParams(
  searchParams: URLSearchParams,
  context: RepositoryHistoryContext,
) {
  searchParams.set("historyVersionType", context.version.type);
  searchParams.set("historyVersion", context.version.value);

  if (context.path) {
    searchParams.set("historyPath", normalizeRepositoryPath(context.path));
  }

  if (context.cursor) {
    searchParams.set("historyCursor", context.cursor);
  }

  return searchParams;
}

export function getRepositoryCommitHref(
  projectId: string,
  repositoryId: string,
  commitId: string,
  options: {
    changesCursor?: string | null;
    history?: RepositoryHistoryContext;
  } = {},
) {
  const searchParams = new URLSearchParams();

  if (options.history) {
    appendHistoryContextSearchParams(searchParams, options.history);
  }

  if (options.changesCursor) {
    searchParams.set("cursor", options.changesCursor);
  }

  const query = searchParams.size > 0 ? `?${searchParams}` : "";

  return `${getRepositoryHref(projectId, repositoryId)}/commits/${encodeURIComponent(commitId)}${query}`;
}

export function getRepositoryCommitDiffHref(
  projectId: string,
  repositoryId: string,
  commitId: string,
  path: string,
  options: {
    basePath?: string | null;
    changesCursor?: string | null;
    history?: RepositoryHistoryContext;
  } = {},
) {
  const searchParams = new URLSearchParams();

  if (options.basePath && options.basePath !== path) {
    searchParams.set("basePath", normalizeRepositoryPath(options.basePath));
  }

  if (options.changesCursor) {
    searchParams.set("changesCursor", options.changesCursor);
  }

  if (options.history) {
    appendHistoryContextSearchParams(searchParams, options.history);
  }

  const query = searchParams.size > 0 ? `?${searchParams}` : "";

  return `${getRepositoryHref(projectId, repositoryId)}/commits/${encodeURIComponent(commitId)}/diff/${encodeRepositoryPath(path)}${query}`;
}

export function getVersionDescriptorSearchParams(
  version: GitVersionDescriptor,
) {
  return new URLSearchParams({
    "versionDescriptor.version": version.value,
    "versionDescriptor.versionOptions": "none",
    "versionDescriptor.versionType": version.type,
  });
}

export function resolveRelativeRepositoryPath(
  baseFilePath: string,
  target: string,
) {
  const hashIndex = target.indexOf("#");
  const queryIndex = target.indexOf("?");
  const suffixIndex = [hashIndex, queryIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const pathOnly =
    suffixIndex === undefined ? target : target.slice(0, suffixIndex);
  const baseSegments = normalizeRepositoryPath(baseFilePath)
    .split("/")
    .filter(Boolean);
  const targetSegments = pathOnly.split("/").flatMap((segment) => {
    try {
      return decodeURIComponent(segment).split("/");
    } catch {
      return [segment];
    }
  });

  if (!pathOnly.startsWith("/")) {
    baseSegments.pop();
  } else {
    baseSegments.length = 0;
  }

  for (const segment of targetSegments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      baseSegments.pop();
      continue;
    }

    baseSegments.push(segment);
  }

  return `/${baseSegments.join("/")}`;
}
