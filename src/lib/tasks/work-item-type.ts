import {
  BookOpenIcon,
  BugIcon,
  ClipboardIcon,
  FileQuestionIcon,
  FlaskConicalIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";

export const SUPPORTED_WORK_ITEM_TYPES = [
  "Bug",
  "Feature",
  "Task",
  "Test Case",
  "Test Plan",
  "Test Suite",
  "User Story",
] as const;

export type SupportedWorkItemType = (typeof SUPPORTED_WORK_ITEM_TYPES)[number];

type WorkItemTypeMeta = Readonly<{
  colorClass: string;
  icon: LucideIcon;
  isSupported: boolean;
  label: string;
}>;

const WORK_ITEM_TYPE_COLORS: Record<SupportedWorkItemType, string> = {
  Bug: "text-red-600 dark:text-red-400",
  Feature: "text-purple-600 dark:text-purple-400",
  Task: "text-amber-600 dark:text-amber-400",
  "Test Case": "text-teal-600 dark:text-teal-400",
  "Test Plan": "text-teal-600 dark:text-teal-400",
  "Test Suite": "text-teal-600 dark:text-teal-400",
  "User Story": "text-blue-600 dark:text-blue-400",
};

const SUPPORTED_WORK_ITEM_TYPE_LOOKUP = new Map(
  SUPPORTED_WORK_ITEM_TYPES.map((type) => [type.toLowerCase(), type] as const),
);
const SUPPORTED_WORK_ITEM_TYPE_ORDER = new Map(
  SUPPORTED_WORK_ITEM_TYPES.map((type, index) => [type, index] as const),
);
const FALLBACK_WORK_ITEM_TYPE_ICON = FileQuestionIcon;

const WORK_ITEM_TYPE_ICONS: Record<SupportedWorkItemType, LucideIcon> = {
  Bug: BugIcon,
  Feature: TrophyIcon,
  Task: ClipboardIcon,
  "Test Case": FlaskConicalIcon,
  "Test Plan": FlaskConicalIcon,
  "Test Suite": FlaskConicalIcon,
  "User Story": BookOpenIcon,
};

export function normalizeWorkItemType(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return SUPPORTED_WORK_ITEM_TYPE_LOOKUP.get(trimmedValue.toLowerCase()) ?? trimmedValue;
}

export function compareWorkItemTypes(left: string, right: string) {
  const normalizedLeft = normalizeWorkItemType(left) ?? left;
  const normalizedRight = normalizeWorkItemType(right) ?? right;
  const leftOrder = SUPPORTED_WORK_ITEM_TYPE_ORDER.get(
    normalizedLeft as SupportedWorkItemType,
  );
  const rightOrder = SUPPORTED_WORK_ITEM_TYPE_ORDER.get(
    normalizedRight as SupportedWorkItemType,
  );

  if (leftOrder !== undefined && rightOrder !== undefined) {
    return leftOrder - rightOrder;
  }

  if (leftOrder !== undefined) {
    return -1;
  }

  if (rightOrder !== undefined) {
    return 1;
  }

  return normalizedLeft.localeCompare(normalizedRight, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function normalizeWorkItemTypes(values: readonly string[] | undefined) {
  const seen = new Set<string>();
  const normalizedValues: string[] = [];

  for (const value of values ?? []) {
    const normalizedValue = normalizeWorkItemType(value);

    if (!normalizedValue) {
      continue;
    }

    const key = normalizedValue.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues.sort(compareWorkItemTypes);
}

export function getDefaultWorkItemTypes(): readonly string[] {
  return SUPPORTED_WORK_ITEM_TYPES;
}

export function getWorkItemTypeMeta(type: string): WorkItemTypeMeta {
  const normalizedType = normalizeWorkItemType(type) ?? "Unknown";
  const icon =
    WORK_ITEM_TYPE_ICONS[normalizedType as SupportedWorkItemType] ??
    FALLBACK_WORK_ITEM_TYPE_ICON;

  const colorClass =
    WORK_ITEM_TYPE_COLORS[normalizedType as SupportedWorkItemType] ??
    "border-border bg-secondary text-secondary-foreground";

  return {
    colorClass,
    icon,
    isSupported: SUPPORTED_WORK_ITEM_TYPE_LOOKUP.has(normalizedType.toLowerCase()),
    label: normalizedType,
  };
}
