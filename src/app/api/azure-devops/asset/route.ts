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
    return NextResponse.json({ error: "Missing asset source." }, { status: 400 });
  }

  try {
    const assetUrl = resolveAzureDevOpsAssetUrl(source);
    const accessToken = await getAzureDevOpsAccessToken();
    const response = await fetch(assetUrl, {
      headers: {
        Accept: "image/*",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to load asset from Azure DevOps." },
        { status: response.status },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Azure DevOps asset is not an image." },
        { status: 415 },
      );
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "private, max-age=300",
        "Content-Type": contentType,
      },
      status: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load asset from Azure DevOps.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
