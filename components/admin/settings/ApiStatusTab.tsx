"use client";

import {
  Bot,
  ImageIcon,
  Loader2,
  Mail,
  Share2,
  Video,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SystemStatusItem } from "@/lib/admin/settings-types";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<string, ReactNode> = {
  "Anthropic Claude API": <Bot className="h-5 w-5 text-navy" />,
  Zernio: <Share2 className="h-5 w-5 text-navy" />,
  "Replicate (Flux)": <ImageIcon className="h-5 w-5 text-navy" />,
  "Google Gemini (Veo)": <Video className="h-5 w-5 text-navy" />,
  Resend: <Mail className="h-5 w-5 text-navy" />,
};

export function ApiStatusTab() {
  const [statuses, setStatuses] = useState<SystemStatusItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch("/api/admin/system-status");
        const result = (await response.json()) as {
          data: SystemStatusItem[] | null;
          error: string | null;
        };

        if (!response.ok || result.error) {
          throw new Error(result.error ?? "Failed to load API status.");
        }

        setStatuses(result.data ?? []);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load API status.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-text-muted">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading API status...
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {statuses.map((item) => (
        <Card key={item.service} className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                {SERVICE_ICONS[item.service]}
              </div>
              <CardTitle className="text-base font-semibold text-navy">
                {item.service}
              </CardTitle>
            </div>
            <Badge
              className={cn(
                item.configured
                  ? "bg-green-100 text-green-700 hover:bg-green-100"
                  : "bg-red-100 text-red-700 hover:bg-red-100"
              )}
            >
              {item.configured ? "Connected" : "Not Configured"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-text-muted">Environment variable</p>
            <p className="font-mono text-text-primary">{item.envVar}</p>
            <p className="text-text-muted">Key preview</p>
            <p className="font-mono text-text-primary">
              {item.maskedKey ?? "Not set"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
