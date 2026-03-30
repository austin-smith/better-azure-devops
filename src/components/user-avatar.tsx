"use client";

import { IdentityImage } from "@/components/identity-image";

function buildUserAvatarSrc(avatarUrl: string) {
  return `/api/avatar?src=${encodeURIComponent(avatarUrl)}`;
}

type UserAvatarProps = {
  avatarUrl: string | null;
  name: string;
  size?: "default" | "sm" | "lg";
};

export function UserAvatar({ avatarUrl, name, size }: UserAvatarProps) {
  return (
    <IdentityImage
      buildImageSrc={buildUserAvatarSrc}
      imageUrl={avatarUrl}
      label={name}
      size={size}
    />
  );
}
