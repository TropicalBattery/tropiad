"use client";

import { Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Promotion } from "@/lib/supabase/types";
import type { PromotionDiscountType } from "@/lib/validations/promotions";

type PromotionFormProps = {
  open: boolean;
  companyId: string;
  activePlatforms: string[];
  onClose: () => void;
  onCreated: (promotion: Promotion) => void;
};

type FormState = {
  title: string;
  description: string;
  discountType: PromotionDiscountType | "";
  discountValue: string;
  promoCode: string;
  startDate: string;
  endDate: string;
  platforms: string[];
};

const DISCOUNT_TYPE_OPTIONS: {
  value: PromotionDiscountType;
  label: string;
}[] = [
  { value: "percentage", label: "Percentage off" },
  { value: "fixed", label: "Fixed amount off" },
  { value: "bogo", label: "Buy one get one" },
  { value: "free_item", label: "Free item" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  discountType: "",
  discountValue: "",
  promoCode: "",
  startDate: "",
  endDate: "",
  platforms: [],
};

export function PromotionForm({
  open,
  companyId,
  activePlatforms,
  onClose,
  onCreated,
}: PromotionFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platformOptions = useMemo(
    () => (activePlatforms.length > 0 ? activePlatforms : ["Instagram"]),
    [activePlatforms]
  );

  if (!open) {
    return null;
  }

  function togglePlatform(platform: string) {
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((value) => value !== platform)
        : [...current.platforms, platform],
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.startDate || !form.endDate) {
      setError("Title, start date, and end date are required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          discount_type: form.discountType || undefined,
          discount_value: form.discountValue.trim() || undefined,
          promo_code: form.promoCode.trim() || undefined,
          start_date: form.startDate,
          end_date: form.endDate,
          platforms: form.platforms,
        }),
      });

      const payload = (await response.json()) as {
        data: Promotion | null;
        error: string | null;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to create promotion.");
      }

      onCreated(payload.data);
      setForm(EMPTY_FORM);
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create promotion.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-label="Close promotion form"
      />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-full flex-col border-l border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#111111] dark:text-white">Add promotion</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#6b7280] dark:text-slate-400 hover:bg-[#FDF2F2] dark:hover:bg-[#f8fafc] dark:bg-[#1f1f1f] hover:text-[#111111] dark:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 py-5"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="promotion-title">Title</Label>
              <Input
                id="promotion-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
                className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotion-description">Description</Label>
              <Textarea
                id="promotion-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
                className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label>Discount type</Label>
              <Select
                value={form.discountType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    discountType: value as PromotionDiscountType,
                  }))
                }
              >
                <SelectTrigger className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white">
                  <SelectValue placeholder="Select discount type" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotion-discount-value">Discount value</Label>
              <Input
                id="promotion-discount-value"
                value={form.discountValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    discountValue: event.target.value,
                  }))
                }
                placeholder="e.g. 20% or $500 JMD"
                className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="promotion-code">Promo code</Label>
              <Input
                id="promotion-code"
                value={form.promoCode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    promoCode: event.target.value,
                  }))
                }
                className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promotion-start-date">Start date</Label>
                <Input
                  id="promotion-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                  required
                  className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promotion-end-date">End date</Label>
                <Input
                  id="promotion-end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                  required
                  className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Platforms</Label>
              <div className="space-y-2">
                {platformOptions.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-3 text-sm text-[#374151] dark:text-slate-300"
                  >
                    <Checkbox
                      checked={form.platforms.includes(platform)}
                      onCheckedChange={() => togglePlatform(platform)}
                    />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
          </div>

          <div className="mt-auto flex justify-end gap-3 border-t border-[#E5E7EB] dark:border-[#2a2a2a] pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-[#E5E7EB] dark:border-[#2a2a2a] bg-transparent text-[#374151] dark:text-slate-300 hover:bg-[#FDF2F2] dark:hover:bg-[#f8fafc] dark:bg-[#1f1f1f]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#CC2B2B] text-white dark:bg-violet-600 hover:bg-violet-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save promotion"
              )}
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}
