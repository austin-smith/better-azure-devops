import { getDefaultTaskView } from "@/lib/tasks/views";

function encodeRouteSegment(value: string) {
  return encodeURIComponent(value);
}

export function getTaskViewHref(viewSlug: string) {
  return `/views/${encodeRouteSegment(viewSlug)}`;
}

export function getTaskDetailHref(taskId: number, viewSlug: string) {
  return `${getTaskViewHref(viewSlug)}/tasks/${taskId}`;
}

export function getDefaultTaskViewHref() {
  return getTaskViewHref(getDefaultTaskView().slug);
}

export function getTaskViewSlugFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] !== "views" || !segments[1]) {
    return null;
  }

  return decodeURIComponent(segments[1]);
}
