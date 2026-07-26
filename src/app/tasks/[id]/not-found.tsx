import { NotFoundState } from "@/components/not-found-state";

export default function TaskNotFound() {
  return (
    <NotFoundState
      backHref="/tasks"
      backLabel="Back to work items"
      description="This work item does not exist, was deleted, or is outside the projects you can access."
      title="Work item not found"
    />
  );
}
