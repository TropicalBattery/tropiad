"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SENDER_EMAIL = "donotreply@autopilot.com";

const DEFAULT_NOTIFICATION_SETTINGS = {
  gate1_email: true,
  gate2_email: true,
  monthly_report: true,
  weekly_summary: false,
};

type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;

const TOGGLES: Array<{
  key: keyof NotificationSettings;
  label: string;
  description: string;
}> = [
  {
    key: "gate1_email",
    label: "Gate 1 approval notifications",
    description: "Email clients when concepts are ready to review",
  },
  {
    key: "gate2_email",
    label: "Gate 2 approval notifications",
    description: "Email clients when final posts are ready to approve",
  },
  {
    key: "monthly_report",
    label: "Monthly performance reports",
    description: "Send clients a monthly summary of their content performance",
  },
  {
    key: "weekly_summary",
    label: "Weekly admin summary",
    description: "Send admin a weekly digest of all client activity",
  },
];

export function NotificationsTab() {
  const [senderEmail, setSenderEmail] = useState(DEFAULT_SENDER_EMAIL);
  const [settings, setSettings] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATION_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/platform-settings");
        const result = (await response.json()) as {
          data: Array<{ key: string; value: string | null }> | null;
          error: string | null;
        };

        if (!response.ok || result.error) {
          throw new Error(result.error ?? "Failed to load platform settings.");
        }

        const senderSetting = result.data?.find(
          (setting) => setting.key === "sender_email"
        );

        if (senderSetting?.value) {
          setSenderEmail(senderSetting.value);
        }

        const notificationSetting = result.data?.find(
          (setting) => setting.key === "notification_settings"
        );

        if (notificationSetting?.value) {
          setSettings({
            ...DEFAULT_NOTIFICATION_SETTINGS,
            ...JSON.parse(notificationSetting.value),
          });
        }
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Failed to load platform settings.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, []);

  async function handleToggle(key: keyof NotificationSettings) {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);

    await fetch("/api/admin/platform-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "notification_settings",
        value: JSON.stringify(updated),
      }),
    });
  }

  async function handleSaveSenderEmail(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = senderEmail.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "sender_email",
          value: trimmed,
        }),
      });

      const result = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to save sender email.");
      }

      setSenderEmail(trimmed);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Failed to save sender email.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-navy">Email Settings</h3>
          <p className="mt-1 text-sm text-text-muted">
            Configure the sender address used for platform notification emails.
          </p>
        </div>

        <form onSubmit={handleSaveSenderEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="senderEmail">Sender email address</Label>
            <p className="text-xs text-text-muted">
              All notification emails will be sent from this address. Must be a
              verified domain in Resend.
            </p>
            <Input
              id="senderEmail"
              type="email"
              value={senderEmail}
              onChange={(event) => {
                setSenderEmail(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              disabled={loading}
              placeholder="donotreply@autopilot.com"
            />
          </div>

          {error ? <p className="text-sm text-rose-500">{error}</p> : null}

          <Button
            type="submit"
            className="bg-tbc-red hover:bg-tbc-red-hover"
            disabled={loading || saving || !senderEmail.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Saved
              </>
            ) : (
              "Save"
            )}
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
        <div className="mb-2">
          <h3 className="text-base font-semibold text-[#111111] dark:text-white">
            Notification preferences
          </h3>
          <p className="mt-1 text-sm text-[#9ca3af] dark:text-slate-500">
            Control which automated emails are sent by the platform.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[#9ca3af] dark:text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settings...
          </div>
        ) : (
          TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-4 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-[#111111] dark:text-white">{toggle.label}</p>
                <p className="mt-0.5 text-xs text-[#9ca3af] dark:text-slate-500">
                  {toggle.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleToggle(toggle.key)}
                className={`relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-colors ${
                  settings[toggle.key]
                    ? "border-violet-500 bg-violet-600"
                    : "border-[#2e2e5a] bg-[#f8fafc] dark:bg-[#1f1f1f]"
                }`}
                aria-pressed={settings[toggle.key]}
                aria-label={toggle.label}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${
                    settings[toggle.key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
