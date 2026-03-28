import { redirect } from "next/navigation";
import { getDefaultTaskViewHref } from "@/lib/tasks/navigation";

export default function HomePage() {
  redirect(getDefaultTaskViewHref());
}
