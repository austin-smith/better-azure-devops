export function formatRepositorySize(bytes: number | null) {
  if (bytes === null || bytes < 0) {
    return "Size unavailable";
  }

  if (bytes < 1_000) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1_000;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1_000; index += 1) {
    value /= 1_000;
    unit = units[index];
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function getCommitTitle(comment: string) {
  return comment.split(/\r?\n/, 1)[0]?.trim() || "No commit message";
}

export function abbreviateCommitId(commitId: string) {
  return commitId.slice(0, 8);
}
