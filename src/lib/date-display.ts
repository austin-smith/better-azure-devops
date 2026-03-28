import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
  isBefore,
  isValid,
  parseISO,
  subDays,
} from "date-fns";

export type DateDisplayOptions = {
  absoluteFormat?: string;
  now?: Date;
  relativeUntilDays?: number;
};

export type DateDisplayResult = {
  isRelative: boolean;
  label: string;
  title: string;
};

const DEFAULT_ABSOLUTE_FORMAT = "MMM d, h:mm a";
const DEFAULT_TITLE_FORMAT = "MMM d, yyyy, h:mm a";
const DEFAULT_RELATIVE_UNTIL_DAYS = 7;

export function parseDateValue(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function getDateDisplay(
  value: string,
  options: DateDisplayOptions = {},
): DateDisplayResult {
  const parsed = parseDateValue(value);

  if (!parsed) {
    return {
      isRelative: false,
      label: "Unknown",
      title: "Unknown",
    };
  }

  const now = options.now ?? new Date();
  const relativeUntilDays =
    options.relativeUntilDays ?? DEFAULT_RELATIVE_UNTIL_DAYS;
  const absoluteFormat = options.absoluteFormat ?? DEFAULT_ABSOLUTE_FORMAT;
  const isRelative = !isBefore(parsed, subDays(now, relativeUntilDays));

  return {
    isRelative,
    label: isRelative ? formatRelativeLabel(parsed, now) : format(parsed, absoluteFormat),
    title: format(parsed, DEFAULT_TITLE_FORMAT),
  };
}

function formatRelativeLabel(value: Date, now: Date) {
  const seconds = differenceInSeconds(now, value);

  if (seconds < 0) {
    return "now";
  }

  if (seconds < 60) {
    return "now";
  }

  const minutes = differenceInMinutes(now, value);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = differenceInHours(now, value);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = differenceInDays(now, value);

  return `${days}d ago`;
}
