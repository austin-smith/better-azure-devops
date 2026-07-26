"use client";

import type { ComponentProps } from "react";
import { Kbd } from "@/components/ui/kbd";
import { useModifierKey } from "@/hooks/use-modifier-key";

export function ModifierKeyKbd(props: ComponentProps<typeof Kbd>) {
  const modifierKey = useModifierKey();

  return <Kbd {...props}>{modifierKey}</Kbd>;
}
