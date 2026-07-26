"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AzureGitRepository } from "@/lib/azure-devops/git/types";

function CopyUrlItem({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1_500);
  }

  return (
    <DropdownMenuItem closeOnClick={false} onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      <span>{copied ? "Copied" : label}</span>
    </DropdownMenuItem>
  );
}

export function RepositoryActions({
  repository,
}: {
  repository: AzureGitRepository;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Repository actions"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <MoreHorizontalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clone</DropdownMenuLabel>
          {repository.remoteUrl ? (
            <CopyUrlItem label="Copy HTTPS URL" value={repository.remoteUrl} />
          ) : null}
          {repository.sshUrl ? (
            <CopyUrlItem label="Copy SSH URL" value={repository.sshUrl} />
          ) : null}
        </DropdownMenuGroup>
        {repository.webUrl ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link
                    href={repository.webUrl}
                    rel="noreferrer"
                    target="_blank"
                  />
                }
              >
                <ExternalLinkIcon />
                Open in Azure DevOps
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
