"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

type RelativeTimeProps = {
  value: string | Date;
  className?: string;
};

export function RelativeTime({ value, className }: RelativeTimeProps) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    setLabel(
      formatDistanceToNow(typeof value === "string" ? new Date(value) : value, {
        addSuffix: true,
      })
    );
  }, [value]);

  return (
    <span className={className} suppressHydrationWarning>
      {label || "\u00a0"}
    </span>
  );
}
