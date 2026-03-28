"use client";

import { useEffect, useState } from "react";
import { getDateDisplay } from "@/lib/date-display";

type DateLabelProps = {
  absoluteFormat?: string;
  className?: string;
  refreshIntervalMs?: number;
  relativeUntilDays?: number;
  value: string;
};

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;

export function DateLabel({
  absoluteFormat,
  className,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  relativeUntilDays,
  value,
}: DateLabelProps) {
  const [now, setNow] = useState(() => new Date());
  const display = getDateDisplay(value, {
    absoluteFormat,
    now,
    relativeUntilDays,
  });

  useEffect(() => {
    if (!display.isRelative) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [display.isRelative, refreshIntervalMs]);

  return (
    <span className={className} title={display.title}>
      {display.label}
    </span>
  );
}
