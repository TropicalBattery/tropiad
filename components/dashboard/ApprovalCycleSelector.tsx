"use client";

import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL_PENDING_RUN_VALUE,
  formatCycleOptionLabel,
  formatWeekOfLabel,
  totalPendingAcrossCycles,
  type ApprovalCycleOption,
} from "@/lib/approvals/approval-cycles";

type ApprovalCycleSelectorProps = {
  options: ApprovalCycleOption[];
  value: string;
  onChange: (value: string) => void;
};

export function ApprovalCycleSelector({
  options,
  value,
  onChange,
}: ApprovalCycleSelectorProps) {
  const selected = options.find((option) => option.runId === value);
  const allPendingTotal = totalPendingAcrossCycles(options);

  const triggerLabel =
    value === ALL_PENDING_RUN_VALUE
      ? "All pending"
      : selected
        ? formatWeekOfLabel(selected.weekStart)
        : "Select a content cycle";

  return (
    <div className="w-full space-y-1.5">
      <label
        htmlFor="approval-cycle-selector"
        className="text-xs font-semibold uppercase tracking-wide text-text-muted"
      >
        Content cycle
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          id="approval-cycle-selector"
          className="h-auto min-h-11 w-full bg-white py-2 dark:bg-[#161616]"
          aria-label="Content cycle"
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
            <span className="truncate font-medium text-text-primary">
              {triggerLabel}
            </span>
            {value === ALL_PENDING_RUN_VALUE ? (
              <Badge variant="secondary">{allPendingTotal} pending</Badge>
            ) : selected ? (
              <>
                <Badge variant={selected.isCurrent ? "success" : "danger"}>
                  {selected.isCurrent ? "Current" : "Overdue"}
                </Badge>
                <Badge variant="secondary">
                  {selected.pendingTotal} pending
                </Badge>
              </>
            ) : null}
            <SelectValue className="sr-only" />
          </span>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((option) => (
            <SelectItem key={option.runId} value={option.runId}>
              {formatCycleOptionLabel(option)}
            </SelectItem>
          ))}
          {options.length > 0 && (
            <SelectItem value={ALL_PENDING_RUN_VALUE}>
              All pending · {allPendingTotal} pending
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
