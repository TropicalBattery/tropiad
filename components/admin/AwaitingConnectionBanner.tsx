"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { ConnectAccountsStep } from "@/components/onboarding/ConnectAccountsStep";
import { Button } from "@/components/ui/button";

type AwaitingConnectionSummary = {
  count: number;
  platforms: string[];
};

type AwaitingConnectionBannerProps = {
  companyId: string;
  companyName: string;
  summary: AwaitingConnectionSummary;
};

export function AwaitingConnectionBanner({
  companyId,
  companyName,
  summary,
}: AwaitingConnectionBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (summary.count === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-medium text-amber-950">
              {summary.count} post{summary.count === 1 ? "" : "s"} ready to
              publish but waiting on account connection:{" "}
              {summary.platforms.join(", ")}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Connect the missing platform accounts to resume automated
              publishing.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-amber-300 bg-white"
          onClick={() => setExpanded((value) => !value)}
        >
          Connect Now
        </Button>
      </div>

      {expanded ? (
        <div className="mt-5 border-t border-amber-200 pt-5">
          <ConnectAccountsStep
            companyId={companyId}
            companyName={companyName}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
