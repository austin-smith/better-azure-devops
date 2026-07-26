import {
  CheckCircle2Icon,
  CircleIcon,
  Clock3Icon,
  XCircleIcon,
} from "lucide-react";
import {
  getCheckToneTextClassName,
  type CheckTone,
} from "@/lib/repositories/pull-request-presentation";
import { cn } from "@/lib/utils";

const TONE_ICONS = {
  negative: XCircleIcon,
  neutral: CircleIcon,
  pending: Clock3Icon,
  positive: CheckCircle2Icon,
} as const;

export function RepositoryCheckIcon({
  className,
  tone,
}: {
  className?: string;
  tone: CheckTone;
}) {
  const Icon = TONE_ICONS[tone];

  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        getCheckToneTextClassName(tone),
        className,
      )}
    />
  );
}
