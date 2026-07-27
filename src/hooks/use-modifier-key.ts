"use client";

import * as React from "react";

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

function resolveModifierKey() {
  if (typeof navigator === "undefined") {
    return "Ctrl";
  }

  const typedNavigator = navigator as NavigatorWithUserAgentData;
  const platform =
    typedNavigator.userAgentData?.platform ?? navigator.platform ?? "";

  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "⌘" : "Ctrl";
}

function subscribeToModifierKey() {
  return () => {};
}

export function useModifierKey() {
  return React.useSyncExternalStore(
    subscribeToModifierKey,
    resolveModifierKey,
    () => "Ctrl",
  );
}
