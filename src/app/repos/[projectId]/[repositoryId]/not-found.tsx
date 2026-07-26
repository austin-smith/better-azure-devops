import Link from "next/link";
import { FolderSearch2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function RepositoryNotFound() {
  return (
    <div className="p-3 md:p-4">
      <Empty className="min-h-72 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderSearch2Icon />
          </EmptyMedia>
          <EmptyTitle>Repository not found</EmptyTitle>
          <EmptyDescription>
            It may have moved, been deleted, or no longer be visible to your
            Azure DevOps identity.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            nativeButton={false}
            render={<Link href="/repos" />}
            variant="outline"
          >
            Back to repositories
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
