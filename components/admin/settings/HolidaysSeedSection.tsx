"use client";

import { Calendar, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function HolidaysSeedSection() {
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/holidays/seed", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        data: { count: number; message: string } | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Failed to seed holidays.");
      }

      toast.success(payload.data?.message ?? "Holidays seeded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to seed holidays.";
      toast.error(message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
            <Calendar className="h-5 w-5 text-navy" />
          </div>
          <CardTitle className="text-base font-semibold text-navy">
            Holiday Calendar
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-text-muted">
          Seed or refresh the platform holiday catalogue (universal, Jamaican,
          US, UK, and commercial occasions). Run after applying the holidays
          migration or when adding new seed entries.
        </p>
        <Button type="button" onClick={() => void handleSeed()} disabled={seeding}>
          {seeding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Seeding...
            </>
          ) : (
            "Seed holidays"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
