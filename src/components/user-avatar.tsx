"use client";

import Image from "next/image";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl: string | null;
  name: string;
  size?: "default" | "sm" | "lg";
};

const avatarPixelSizes = {
  default: 32,
  lg: 40,
  sm: 24,
} as const;

function avatarFallback(label: string) {
  return (
    label
      .split(" ")
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "??"
  );
}

function avatarProxyUrl(avatarUrl: string | null) {
  return avatarUrl ? `/api/avatar?src=${encodeURIComponent(avatarUrl)}` : undefined;
}

export function UserAvatar({ avatarUrl, name, size }: UserAvatarProps) {
  const resolvedSize = size ?? "default";
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageSrc = avatarProxyUrl(avatarUrl);
  const imageSize = avatarPixelSizes[resolvedSize];

  return (
    <Avatar size={resolvedSize}>
      <AvatarFallback>{avatarFallback(name)}</AvatarFallback>
      {imageSrc && !hasError ? (
        <Image
          alt={name}
          className={cn(
            "absolute inset-0 size-full object-cover",
            hasLoaded ? "opacity-100" : "opacity-0",
          )}
          height={imageSize}
          onError={() => {
            setHasError(true);
          }}
          onLoad={() => {
            setHasLoaded(true);
          }}
          src={imageSrc}
          unoptimized
          width={imageSize}
        />
      ) : null}
    </Avatar>
  );
}
