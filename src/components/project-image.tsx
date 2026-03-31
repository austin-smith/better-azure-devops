"use client";

import Image from "next/image";
import { useState } from "react";
import { buildAzureDevOpsAssetProxyPath } from "@/lib/azure-devops/assets";
import { cn } from "@/lib/utils";

type ProjectImageProps = {
  className?: string;
  imageClassName?: string;
  imageUrl: string | null;
  name: string;
  size?: "default" | "sm" | "lg";
};

const imagePixelSizes = {
  default: 32,
  lg: 40,
  sm: 24,
} as const;

const imageSizeClassNames = {
  default: "size-8",
  lg: "size-10",
  sm: "size-6",
} as const;

function imageFallback(label: string) {
  return (
    label
      .split(" ")
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "??"
  );
}

export function ProjectImage({
  className,
  imageClassName,
  imageUrl,
  name,
  size,
}: ProjectImageProps) {
  const resolvedSize = size ?? "default";
  const [hasError, setHasError] = useState(false);
  const imageSrc = imageUrl ? buildAzureDevOpsAssetProxyPath(imageUrl) : undefined;
  const imageSize = imagePixelSizes[resolvedSize];
  const showFallback = !imageSrc || hasError;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-sm leading-none text-muted-foreground ring-1 ring-border",
        imageSizeClassNames[resolvedSize],
        className,
      )}
    >
      {showFallback ? <span>{imageFallback(name)}</span> : null}
      {imageSrc && !hasError ? (
        <Image
          alt={name}
          className={cn(
            "absolute inset-0 size-full rounded-md object-cover",
            imageClassName,
          )}
          height={imageSize}
          onError={() => {
            setHasError(true);
          }}
          src={imageSrc}
          unoptimized
          width={imageSize}
        />
      ) : null}
    </span>
  );
}
