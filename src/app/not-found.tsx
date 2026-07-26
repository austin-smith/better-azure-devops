import { NotFoundState } from "@/components/not-found-state";

export default function NotFound() {
  return (
    <NotFoundState
      backHref="/"
      backLabel="Return home"
      description="The requested page does not exist or may have moved."
      title="Page not found"
    />
  );
}
