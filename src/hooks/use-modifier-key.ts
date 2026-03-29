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

export function useModifierKey() {
  const [modifierKey, setModifierKey] = React.useState("Ctrl");

  React.useEffect(() => {
    setModifierKey(resolveModifierKey());
  }, []);

  return modifierKey;
}
