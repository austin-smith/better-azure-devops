import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { describeAzureDevOpsError } from "@/lib/azure-devops/errors";
import { getRepositoryItemContent } from "@/lib/azure-devops/git/items";
import type {
  GitVersionDescriptor,
  GitVersionType,
} from "@/lib/azure-devops/git/types";
import { normalizeRepositoryPath } from "@/lib/azure-devops/git/urls";

const VERSION_TYPES = new Set<GitVersionType>(["branch", "commit", "tag"]);

function getVersion(url: URL): GitVersionDescriptor | null {
  const value = url.searchParams.get("version")?.trim();
  const rawType = url.searchParams.get("versionType");

  if (
    !value ||
    !rawType ||
    !VERSION_TYPES.has(rawType as GitVersionType)
  ) {
    return null;
  }

  return {
    type: rawType as GitVersionType,
    value,
  };
}

function getContentDisposition(path: string) {
  const fileName = path.split("/").pop() || "download";
  const asciiFallback =
    fileName.replaceAll(/[^\x20-\x7e]|["\\]/g, "_") || "download";
  const encodedFileName = encodeURIComponent(fileName).replaceAll(
    /['()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`;
}

function isActiveDocumentContentType(contentType: string) {
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();

  return (
    mediaType === "application/pdf" ||
    mediaType === "application/xhtml+xml" ||
    mediaType === "application/xml" ||
    mediaType === "text/html" ||
    mediaType === "text/xml"
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      projectId: string;
      repositoryId: string;
    }>;
  },
) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  const version = getVersion(url);

  if (!path || !version) {
    return Response.json(
      { error: "A repository path and valid version are required." },
      { status: 400 },
    );
  }

  const { projectId, repositoryId } = await params;
  const normalizedPath = normalizeRepositoryPath(path);
  const download = url.searchParams.get("download") === "true";
  const sanitize =
    !download && normalizedPath.toLowerCase().endsWith(".svg");

  try {
    const accessToken = await getAzureDevOpsAccessToken();
    const upstream = await getRepositoryItemContent(
      accessToken,
      projectId,
      repositoryId,
      normalizedPath,
      version,
      {
        download,
        resolveLfs: true,
        sanitize,
      },
    );
    const headers = new Headers();
    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    headers.set("Cache-Control", "private, max-age=300");
    headers.set(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; style-src 'unsafe-inline'",
    );
    headers.set("Content-Type", contentType);
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");

    if (download || isActiveDocumentContentType(contentType)) {
      headers.set("Content-Disposition", getContentDisposition(normalizedPath));
    }

    return new Response(upstream.body, {
      headers,
      status: upstream.status,
    });
  } catch (error) {
    const descriptor = describeAzureDevOpsError(error);

    return Response.json(
      { error: descriptor.message },
      { status: descriptor.status ?? 502 },
    );
  }
}
