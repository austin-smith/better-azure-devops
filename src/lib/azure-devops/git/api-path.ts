export function getGitRepositoryApiPath(
  projectId: string,
  repositoryId?: string,
) {
  const project = encodeURIComponent(projectId);

  return repositoryId
    ? `/${project}/_apis/git/repositories/${encodeURIComponent(repositoryId)}`
    : `/${project}/_apis/git/repositories`;
}

export function parsePageCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0;
  }

  const parsed = Number(cursor);

  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}
