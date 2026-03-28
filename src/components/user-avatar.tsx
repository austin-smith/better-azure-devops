import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserAvatarProps = {
  avatarUrl: string | null;
  name: string;
  size?: "default" | "sm" | "lg";
};

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
  return (
    <Avatar size={size}>
      <AvatarImage alt={name} src={avatarProxyUrl(avatarUrl)} />
      <AvatarFallback>{avatarFallback(name)}</AvatarFallback>
    </Avatar>
  );
}
