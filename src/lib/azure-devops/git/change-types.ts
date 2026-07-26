/**
 * Azure DevOps returns Git change types as comma-separated flags. Match whole
 * flags so distinct values such as `undelete` are not treated as `delete`.
 */
export function getAzureGitChangeTypes(changeType: string) {
  return new Set(
    changeType
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasAzureGitChangeType(
  changeType: string,
  expected: string,
) {
  return getAzureGitChangeTypes(changeType).has(expected.toLowerCase());
}
