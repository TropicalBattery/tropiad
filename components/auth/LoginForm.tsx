"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSingleCompanyDashboardPath } from "@/lib/config/single-company";
import { createClient } from "@/lib/supabase/client";

type AuthCallbackResponse = {
  role: "marketing" | "approver" | null;
  slug: string | null;
  error?: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      const callbackResponse = await fetch("/api/auth/callback", {
        method: "POST",
      });

      if (!callbackResponse.ok) {
        setError("Unable to load your account profile. Please try again.");
        return;
      }

      const data = (await callbackResponse.json()) as AuthCallbackResponse;

      if (data.role === "marketing" || data.role === "approver") {
        router.push(
          data.slug
            ? `/dashboard/${data.slug}`
            : getSingleCompanyDashboardPath()
        );
        router.refresh();
        return;
      }

      setError(
        "Your account is authenticated but not authorized for Autopilot. Ask an admin to grant the marketing or approver role."
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
        >
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          className="rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 text-sm text-[#111111] focus-visible:border-tbc-red focus-visible:bg-white focus-visible:ring-tbc-red/10"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="password"
          className="text-xs font-semibold uppercase tracking-widest text-[#6B7280]"
        >
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="rounded-xl border-[1.5px] border-[#E5E7EB] bg-[#F9FAFB] py-3 pl-4 pr-11 text-sm text-[#111111] focus-visible:border-tbc-red focus-visible:bg-white focus-visible:ring-tbc-red/10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-[#FCA5A5] bg-[#FDF2F2] px-4 py-3 text-sm text-tbc-red"
        >
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full py-3">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
