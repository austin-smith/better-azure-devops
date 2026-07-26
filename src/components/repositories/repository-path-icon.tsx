import { FileIcon, FolderIcon } from "@react-symbols/icons/utils";
import { cn } from "@/lib/utils";

type RepositoryPathIconProps = {
  className?: string;
  kind: "file" | "folder";
  path: string;
};

export function getRepositoryPathName(path: string) {
  const normalizedPath = path.replace(/\/+$/, "");

  return normalizedPath.split("/").at(-1)?.toLowerCase() ?? "";
}

export function RepositoryPathIcon({
  className,
  kind,
  path,
}: RepositoryPathIconProps) {
  const name = getRepositoryPathName(path);
  const iconProps = {
    "aria-hidden": true,
    className: cn("size-4 shrink-0", className),
    focusable: "false",
  } as const;

  return kind === "folder" ? (
    <FolderIcon folderName={name} {...iconProps} />
  ) : (
    <FileIcon autoAssign fileName={name} {...iconProps} />
  );
}
