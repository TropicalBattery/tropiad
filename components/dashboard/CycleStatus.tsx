import { Cycle } from "@/lib/supabase/types";
import { pipelineStageLabel } from "@/lib/utils/dashboard";

import { StatusBadge } from "@/components/shared/StatusBadge";

type CycleStatusProps = {
  cycle: Cycle | null;
  gate1Pending: number;
  gate2Pending: number;
};

export function CycleStatus({
  cycle,
  gate1Pending,
  gate2Pending,
}: CycleStatusProps) {
  const stage = pipelineStageLabel(cycle?.status);

  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-accent-violet">
            This week&apos;s pipeline
          </p>
          <p className="mt-1 font-display text-lg font-semibold capitalize text-text-primary">
            {stage}
          </p>
          {cycle?.status ? (
            <StatusBadge status={cycle.status} className="mt-2" />
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Concepts" value={cycle?.concepts_generated ?? 0} />
          <Stat label="Approved" value={cycle?.concepts_approved ?? 0} />
          <Stat label="Published" value={cycle?.posts_published ?? 0} />
          <Stat label="Gate 1 pending" value={gate1Pending} accent />
          <Stat label="Gate 2 pending" value={gate2Pending} accent />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface-hover px-3 py-2">
      <p className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-display text-xl font-semibold text-accent-teal"
            : "font-display text-xl font-semibold text-text-primary"
        }
      >
        {value}
      </p>
    </div>
  );
}
