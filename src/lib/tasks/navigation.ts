import { getDefaultTaskView } from "@/lib/tasks/views";

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value);
}

export function getTaskViewHref(viewSlug: string) {
  return `/${encodeRouteSegment(viewSlug)}`;
}

export function getTaskDetailHref(taskId: number) {
  return `/tasks/${taskId}`;
}

export function getDefaultTaskViewHref() {
  return getTaskViewHref(getDefaultTaskView().slug);
}

export function getTaskViewSlugFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length !== 1) {
    return null;
  }

  return decodeURIComponent(segments[0]);
}
