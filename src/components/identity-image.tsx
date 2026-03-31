"use client";

import Image from "next/image";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buildAzureDevOpsAssetProxyPath } from "@/lib/azure-devops/assets";
import { cn } from "@/lib/utils";

type IdentityImageProps = {
  buildImageSrc?: (imageUrl: string) => string;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  imageUrl: string | null;
  label: string;
  shape?: "circle" | "rounded";
  size?: "default" | "sm" | "lg";
};

const imagePixelSizes = {
  default: 32,
  lg: 40,
  sm: 24,
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

export function IdentityImage({
  buildImageSrc = buildAzureDevOpsAssetProxyPath,
  className,
  fallbackClassName,
  imageClassName,
  imageUrl,
  label,
  shape = "circle",
  size,
}: IdentityImageProps) {
  const resolvedSize = size ?? "default";
  const [hasError, setHasError] = useState(false);
  const imageSrc = imageUrl ? buildImageSrc(imageUrl) : undefined;
  const imageSize = imagePixelSizes[resolvedSize];
  const shapeClassName =
    shape === "rounded" ? "rounded-md after:rounded-md" : undefined;
  const imageShapeClassName = shape === "rounded" ? "rounded-md" : undefined;
  const showFallback = !imageSrc || hasError;

  return (
    <Avatar className={cn(shapeClassName, className)} size={resolvedSize}>
      {showFallback ? (
        <AvatarFallback className={cn(imageShapeClassName, fallbackClassName)}>
          {imageFallback(label)}
        </AvatarFallback>
      ) : null}
      {imageSrc && !hasError ? (
        <Image
          alt={label}
          className={cn(
            "absolute inset-0 size-full object-cover",
            imageShapeClassName,
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
    </Avatar>
  );
}
