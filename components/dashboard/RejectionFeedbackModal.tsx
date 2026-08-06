"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  GATE1_REJECTION_REASONS,
  getGate2RejectionReasons,
  type RejectionGate,
} from "@/lib/constants/rejection-reasons";

type RejectionFeedbackModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gate: RejectionGate;
  hasVisual: boolean;
  isSubmitting: boolean;
  onConfirm: (reasons: string[], freeText: string) => Promise<void>;
};

export function RejectionFeedbackModal({
  open,
  onOpenChange,
  gate,
  hasVisual,
  isSubmitting,
  onConfirm,
}: RejectionFeedbackModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  const availableReasons = useMemo(
    () =>
      gate === "gate1"
        ? GATE1_REJECTION_REASONS
        : getGate2RejectionReasons(hasVisual),
    [gate, hasVisual]
  );

  useEffect(() => {
    if (!open) {
      setSelectedReasons([]);
      setFreeText("");
    }
  }, [open]);

  const canConfirm =
    selectedReasons.length > 0 || freeText.trim().length > 0;

  function toggleReason(reason: string, checked: boolean) {
    setSelectedReasons((current) =>
      checked
        ? [...current, reason]
        : current.filter((item) => item !== reason)
    );
  }

  async function handleConfirm() {
    if (!canConfirm) {
      return;
    }

    await onConfirm(selectedReasons, freeText.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>What&apos;s not working?</DialogTitle>
          <DialogDescription>
            This helps us create better content for you going forward
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            {availableReasons.map((reason) => {
              const checkboxId = `reject-reason-${reason.replace(/\s+/g, "-")}`;

              return (
                <div key={reason} className="flex items-start gap-3">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedReasons.includes(reason)}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) =>
                      toggleReason(reason, checked === true)
                    }
                  />
                  <Label
                    htmlFor={checkboxId}
                    className="cursor-pointer font-normal leading-snug"
                  >
                    {reason}
                  </Label>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-free-text">
              Anything else? (optional)
            </Label>
            <Textarea
              id="rejection-free-text"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              rows={4}
              disabled={isSubmitting}
              placeholder="Share any additional context..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || isSubmitting}
            onClick={() => void handleConfirm()}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
