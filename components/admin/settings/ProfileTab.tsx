"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionUser } from "@/lib/auth/user";

type ProfileTabProps = {
  sessionUser: SessionUser;
};

export function ProfileTab({ sessionUser }: ProfileTabProps) {
  const [fullName, setFullName] = useState(sessionUser.fullName);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });

      const result = (await response.json()) as {
        data: { fullName: string | null } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to update profile.");
      }

      toast.success("Profile updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    setResetting(true);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
      });

      const result = (await response.json()) as {
        data: { success: boolean } | null;
        error: string | null;
      };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to send reset email.");
      }

      toast.success("Password reset email sent.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to send reset email.";
      toast.error(message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <form
        onSubmit={handleSaveProfile}
        className="space-y-4 rounded-xl border border-border bg-white p-6 shadow-sm"
      >
        <div className="space-y-2">
          <Label htmlFor="profileName">Name</Label>
          <Input
            id="profileName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profileEmail">Email</Label>
          <Input
            id="profileEmail"
            value={sessionUser.email}
            disabled
            readOnly
          />
          <p className="text-xs text-text-muted">
            Email is read-only and managed through authentication.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            className="bg-tbc-red hover:bg-tbc-red-hover"
            disabled={saving || !fullName.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resetting}
            onClick={() => void handleChangePassword()}
          >
            {resetting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
