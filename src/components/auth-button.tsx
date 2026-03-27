"use client";

import { signIn, signOut } from "next-auth/react";

type AuthButtonProps = {
  enabled: boolean;
  signedIn: boolean;
};

export function AuthButton({ enabled, signedIn }: AuthButtonProps) {
  if (signedIn) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded border bg-surface-raised px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-border-strong hover:text-text"
      >
        Sign Out
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={() => signIn("azure-ad")}
      className="rounded bg-accent px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-white transition-all hover:shadow-[0_0_12px_rgba(255,92,57,0.3)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      Sign In
    </button>
  );
}
