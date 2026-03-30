import { NextRequest, NextResponse } from "next/server";
import { getAzureDevOpsAccessToken } from "@/lib/azure-devops/access-token";
import { resolveAzureDevOpsAssetUrl } from "@/lib/azure-devops/assets";
import { hasAzureDevOpsConfig } from "@/lib/azure-devops/config";

export async function GET(request: NextRequest) {
  if (!hasAzureDevOpsConfig()) {
    return NextResponse.json(
      {
        error:
          "Azure DevOps config is missing. Set AZURE_DEVOPS_ORG_URL.",
      },
      { status: 503 },
    );
  }

  const source = request.nextUrl.searchParams.get("src");

  if (!source) {
    return NextResponse.json({ error: "Missing avatar source." }, { status: 400 });
  }

  try {
    const avatarUrl = resolveAzureDevOpsAssetUrl(source);
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
