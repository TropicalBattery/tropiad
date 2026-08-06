"use client";

import { useState } from "react";
import { toast } from "sonner";

type RunNowResponse = {
  runId: string;
  status: string;
  advanced: boolean;
  created?: boolean;
  statusBefore?: string | null;
  ideationRan?: boolean;
};

export function useRunNowPipeline(companySlug: string) {
  const [running, setRunning] = useState(false);

  async function runNow() {
    if (!companySlug) {
      toast.error("Client slug is missing.");
      return;
    }

    setRunning(true);
    try {
      const response = await fetch(
        `/api/admin/clients/${companySlug}/run-now`,
        {
          method: "POST",
        }
      );
      const payload = (await response.json()) as {
        data: RunNowResponse | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Pipeline run failed.");
      }

      const data = payload.data;
      const status = data?.status ?? "pending";
      const advanced = data?.advanced === true;
      const ideationRan = data?.ideationRan === true;

      if (ideationRan) {
        toast.success("New content generated. Review it under Approve.");
      } else if (advanced) {
        toast.success(`Pipeline advanced (${status}).`);
      } else {
        toast(
          `This week's run is already at ${status}. Nothing new to generate.`
        );
      }

      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pipeline run failed.";
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  return { running, runNow };
}
