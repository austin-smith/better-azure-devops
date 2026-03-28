import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { getAzureDevOpsConfig, hasAzureDevOpsConfig } from "@/lib/azure-devops/config";

const AZURE_DEVOPS_AVATAR_HOSTS = new Set([
  "aex.dev.azure.com",
  "dev.azure.com",
  "vssps.dev.azure.com",
]);

function resolveAvatarUrl(source: string) {
  const config = getAzureDevOpsConfig();
  const orgHost = new URL(config.orgUrl).host;
  const url = new URL(source, config.orgUrl);

  if (url.protocol !== "https:") {
    throw new Error("Avatar URL must use HTTPS.");
  }

  if (url.host !== orgHost && !AZURE_DEVOPS_AVATAR_HOSTS.has(url.host)) {
    throw new Error("Avatar URL host is not allowed.");
  }

  return url;
}

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT.",
      },
      { status: 503 },
    );
  }

  const source = request.nextUrl.searchParams.get("src");

  if (!source) {
    return NextResponse.json({ error: "Missing avatar source." }, { status: 400 });
  }

  try {
    const avatarUrl = resolveAvatarUrl(source);
    const accessToken = await getAzureDevOpsAccessToken();
    const response = await fetch(avatarUrl, {
      headers: {
        Accept: "image/*",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load avatar from Azure DevOps." },
        { status: response.status },
      );
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": response.headers.get("content-type") ?? "image/png",
      },
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load avatar from Azure DevOps.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
