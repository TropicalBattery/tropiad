"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ExpandableTextProps = {
  text: string;
  className?: string;
};

export function ExpandableText({ text, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element || expanded) {
      return;
    }

    function checkOverflow() {
      if (!element) {
        return;
      }

      setCanExpand(element.scrollHeight > element.clientHeight + 1);
    }

    checkOverflow();
    window.addEventListener("resize", checkOverflow);

    return () => window.removeEventListener("resize", checkOverflow);
  }, [text, expanded]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <p
          ref={textRef}
          className={cn(
            "whitespace-pre-wrap text-sm text-text-primary",
            !expanded && "line-clamp-3"
          )}
        >
          {text}
        </p>
        {!expanded && canExpand && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-bg-surface to-transparent"
          />
        )}
      </div>
      {canExpand && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1.5 text-xs font-medium text-accent-violet transition-colors hover:text-[#CC2B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
