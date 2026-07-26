"use client";

import { SearchIcon } from "lucide-react";
import { useCommandCenter } from "@/components/command-center/command-center";
import { ModifierKeyKbd } from "@/components/modifier-key-kbd";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export function CommandCenterTrigger() {
  const { openCommandCenter } = useCommandCenter();

  return (
    <Button
      aria-haspopup="dialog"
      aria-label="Open command center"
      onClick={openCommandCenter}
      size="sm"
      variant="outline"
    >
      <SearchIcon data-icon="inline-start" />
      <span className="hidden sm:inline">Search</span>
      <KbdGroup className="hidden md:inline-flex">
        <ModifierKeyKbd />
        <Kbd>K</Kbd>
      </KbdGroup>
    </Button>
  );
}
