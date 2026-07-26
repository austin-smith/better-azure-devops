import type { PullRequestThreadSnippetLine } from "@/lib/repositories/pull-request-threads";
import { cn } from "@/lib/utils";

/**
 * Mirrors the code context Azure DevOps and GitHub show above a file thread, so
 * a comment can be read without opening the diff.
 */
export function RepositoryPullRequestThreadSnippet({
  lines,
}: {
  lines: PullRequestThreadSnippetLine[];
}) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto border-b bg-muted/10">
      <table className="w-full border-collapse font-mono text-xs">
        <tbody>
          {lines.map((line) => (
            <tr
              className={cn(
                line.isCommented && "bg-amber-500/10 dark:bg-amber-400/10",
              )}
              key={line.number}
            >
              <td className="w-12 shrink-0 border-r px-2 py-0.5 text-right align-top text-muted-foreground select-none">
                {line.number}
              </td>
              <td className="px-3 py-0.5 whitespace-pre">
                {line.content || " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
