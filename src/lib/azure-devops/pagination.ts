export type AzureDevOpsPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export function getContinuationToken(headers: Headers) {
  const value =
    headers.get("x-ms-continuationtoken") ??
    headers.get("x-ms-continuation-token");

  return value?.trim() || null;
}
