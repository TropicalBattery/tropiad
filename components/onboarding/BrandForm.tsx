"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, CheckCircle2, Loader2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConnectAccountsStep } from "@/components/onboarding/ConnectAccountsStep";
import { AssetUploader } from "@/components/onboarding/AssetUploader";
import { TagInput } from "@/components/onboarding/TagInput";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { BrandConfig } from "@/lib/supabase/types";
import {
  adjustContentMix,
  defaultOnboardValues,
  IMAGE_STYLES,
  INDUSTRY_SUGGESTIONS,
  onboardSchema,
  PLATFORMS,
  slugify,
  TIMEZONES,
  TONES,
  validateOnboardStep,
  type OnboardFormData,
} from "@/lib/validations/onboard";
import { cn } from "@/lib/utils";
import { normalizeIndustries } from "@/lib/validations/brand-config-normalize";

const TONE_DESCRIPTIONS: Record<(typeof TONES)[number], string> = {
  Professional: "Polished, authoritative, and industry-leading.",
  Casual: "Friendly, approachable, and conversational.",
  Playful: "Light-hearted, witty, and engaging.",
  Bold: "Confident, direct, and attention-grabbing.",
};

type FieldErrors = Partial<Record<keyof OnboardFormData | "form", string>>;

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

async function requestAdminApi<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? "Request failed.");
  }

  if (payload.data === null) {
    throw new Error("Request returned no data.");
  }

  return payload.data;
}

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#0D9488"
          className="font-mono uppercase"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function StepSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border border-border bg-white shadow-sm">
      <CardHeader className="border-b border-border bg-slate-50/80">
        <CardTitle className="text-xl text-navy">{title}</CardTitle>
        <CardDescription className="mt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">{children}</CardContent>
    </Card>
  );
}

function HorizontalStepper({
  steps,
  currentStep,
  onStepClick,
}: {
  steps: Array<{ id: number; title: string }>;
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="flex w-full items-start">
      {steps.map((step, index) => {
        const complete = step.id < currentStep;
        const active = step.id === currentStep;
        const isLast = index === steps.length - 1;
        const lineComplete = step.id + 1 < currentStep;

        return (
          <div key={step.id} className="flex flex-1 items-start">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
              <button
                type="button"
                disabled={!complete}
                onClick={() => {
                  if (complete) {
                    onStepClick(step.id);
                  }
                }}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-colors",
                  complete &&
                    "cursor-pointer bg-[#CC2B2B] text-white dark:bg-tbc-red hover:bg-tbc-red-hover",
                  active && "bg-[#CC2B2B] text-white dark:bg-navy",
                  !complete &&
                    !active &&
                    "border-2 border-slate-300 bg-white text-[#6b7280] dark:text-slate-400",
                  complete && "disabled:cursor-default"
                )}
              >
                {complete ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </button>
              <button
                type="button"
                disabled={!complete}
                onClick={() => {
                  if (complete) {
                    onStepClick(step.id);
                  }
                }}
                className={cn(
                  "max-w-[120px] text-xs sm:text-sm",
                  active && "font-semibold text-navy",
                  complete && "cursor-pointer text-tbc-red hover:underline",
                  !complete && !active && "text-text-muted",
                  !complete && "cursor-default"
                )}
              >
                {step.title}
              </button>
            </div>
            {!isLast ? (
              <div
                className={cn(
                  "mt-5 h-0.5 min-w-[16px] flex-1",
                  lineComplete ? "bg-tbc-red" : "bg-slate-200"
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function RadioCards<T extends string>({
  options,
  value,
  onChange,
  descriptions,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  descriptions?: Record<T, string>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border p-4 text-left transition-all",
              selected
                ? "border-[#0D9488] bg-[#0D9488]/5 ring-2 ring-[#0D9488]/30"
                : "border-slate-200 bg-white hover:border-[#0D9488]/40"
            )}
          >
            <p className="font-semibold text-[#0B1C3D]">{option}</p>
            {descriptions?.[option] && (
              <p className="mt-1 text-sm text-slate-600">
                {descriptions[option]}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function BrandForm({ initialCompanyId }: { initialCompanyId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<OnboardFormData>(defaultOnboardValues);
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [companyId, setCompanyId] = useState<string | null>(
    initialCompanyId ?? null
  );

  const steps = [
    { id: 1, title: "Company Details" },
    { id: 2, title: "Connect Accounts" },
    { id: 3, title: "Brand Voice" },
    { id: 4, title: "Visual Identity" },
    { id: 5, title: "Content Mix" },
  ];

  const contentMixTotal = useMemo(
    () => form.promotionalPct + form.educationalPct + form.engagementPct,
    [form.promotionalPct, form.educationalPct, form.engagementPct]
  );

  function updateField<K extends keyof OnboardFormData>(
    key: K,
    value: OnboardFormData[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleCompanyNameChange(name: string) {
    setForm((current) => ({
      ...current,
      companyName: name,
      slug: slugEdited ? current.slug : slugify(name),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.companyName;
      if (!slugEdited) delete next.slug;
      return next;
    });
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    updateField("slug", slugify(slug));
  }

  function togglePlatform(platform: (typeof PLATFORMS)[number]) {
    setForm((current) => {
      const isActive = current.activePlatforms.includes(platform);
      const activePlatforms = isActive
        ? current.activePlatforms.filter((item) => item !== platform)
        : [...current.activePlatforms, platform];

      const preferredTimes = { ...current.preferredTimes };
      if (!isActive) {
        preferredTimes[platform] = preferredTimes[platform] ?? "09:00";
      } else {
        delete preferredTimes[platform];
      }

      return { ...current, activePlatforms, preferredTimes };
    });
  }

  function handleContentMixChange(
    key: "promotionalPct" | "educationalPct" | "engagementPct",
    value: number
  ) {
    const next = adjustContentMix(form, key, value);
    setForm((current) => ({ ...current, ...next }));
  }

  function applyStepErrors(step: 1 | 2 | 3 | 4 | 5) {
    const result = validateOnboardStep(step, form);
    if (result.success) {
      return true;
    }

    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field as keyof OnboardFormData]) {
        fieldErrors[field as keyof OnboardFormData] = issue.message;
      }
    }
    setErrors(fieldErrors);
    toast.error("Please fix the highlighted fields before continuing.");
    return false;
  }

  useEffect(() => {
    if (!initialCompanyId) {
      return;
    }

    const resumeCompanyId: string = initialCompanyId;

    async function loadExistingCompany() {
      try {
        const result = await requestAdminApi<{
          company: {
            id: string;
            name: string;
            slug: string;
            owner_email: string;
          };
          brand: BrandConfig | null;
        }>(`/api/admin/onboard/company?companyId=${resumeCompanyId}`);

        const { company, brand } = result;

        setCompanyId(company.id);
        setSlugEdited(true);

        if (brand) {
          setForm((current) => ({
            ...current,
            companyName: company.name,
            slug: company.slug,
            ownerEmail: company.owner_email,
            industry: normalizeIndustries(brand.industry),
            targetAudience: brand.target_audience ?? "",
            uniqueSellingPoint: brand.unique_selling_point ?? "",
            tone: (brand.tone as OnboardFormData["tone"]) ?? current.tone,
            brandVoiceDoc: brand.brand_voice_doc ?? "",
            topicsToCover: brand.topics_to_cover ?? [],
            topicsToAvoid: brand.topics_to_avoid ?? [],
            competitorHandles: brand.competitor_handles ?? [],
            primaryColor: brand.primary_color ?? current.primaryColor,
            secondaryColor: brand.secondary_color ?? current.secondaryColor,
            accentColor: brand.accent_color ?? current.accentColor,
            logoUrl: brand.logo_url,
            imageStyle:
              (brand.image_style as OnboardFormData["imageStyle"]) ??
              current.imageStyle,
            postFrequency: brand.post_frequency ?? current.postFrequency,
            activePlatforms:
              (brand.active_platforms as OnboardFormData["activePlatforms"]) ??
              current.activePlatforms,
            timezone: brand.timezone ?? current.timezone,
            promotionalPct: brand.promotional_pct ?? current.promotionalPct,
            educationalPct: brand.educational_pct ?? current.educationalPct,
            engagementPct: brand.engagement_pct ?? current.engagementPct,
            preferredTimes:
              (brand.preferred_times as OnboardFormData["preferredTimes"]) ??
              current.preferredTimes,
          }));

          if (!brand.brand_voice_doc) {
            setCurrentStep(3);
          } else if (!brand.active_platforms?.length) {
            setCurrentStep(4);
          } else {
            setCurrentStep(5);
          }
        } else {
          setCurrentStep(2);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load company.";
        toast.error(message);
      }
    }

    void loadExistingCompany();
  }, [initialCompanyId]);

  async function createCompanyAndBrand(): Promise<string> {
    if (companyId) {
      return companyId;
    }

    const company = await requestAdminApi<{ id: string; slug: string }>(
      "/api/admin/onboard/company",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          slug: form.slug,
          ownerEmail: form.ownerEmail,
          industry: form.industry,
          targetAudience: form.targetAudience,
          uniqueSellingPoint: form.uniqueSellingPoint,
        }),
      }
    );

    setCompanyId(company.id);
    return company.id;
  }

  async function updateBrandConfig(fields: Record<string, unknown>) {
    if (!companyId) {
      throw new Error("Company has not been created yet.");
    }

    await requestAdminApi<BrandConfig>(
      `/api/admin/brand-config/${companyId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      }
    );
  }

  function goToStep(step: number) {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  }

  async function handleNext() {
    if (currentStep === 1) {
      if (!applyStepErrors(1)) {
        return;
      }

      setIsSubmitting(true);
      try {
        await createCompanyAndBrand();
        setCurrentStep(2);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create company.";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep === 2) {
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (!applyStepErrors(3)) {
        return;
      }

      setIsSubmitting(true);
      try {
        await updateBrandConfig({
          tone: form.tone,
          brand_voice_doc: form.brandVoiceDoc,
          topics_to_cover: form.topicsToCover,
          topics_to_avoid: form.topicsToAvoid,
          competitor_handles: form.competitorHandles,
        });
        setCurrentStep(4);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save brand voice.";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (currentStep === 4) {
      if (!applyStepErrors(4)) {
        return;
      }

      setIsSubmitting(true);
      try {
        await updateBrandConfig({
          primary_color: form.primaryColor,
          secondary_color: form.secondaryColor,
          accent_color: form.accentColor,
          logo_url: form.logoUrl,
          image_style: form.imageStyle,
          post_frequency: form.postFrequency,
          active_platforms: form.activePlatforms,
          timezone: form.timezone,
        });
        setCurrentStep(5);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to save visual identity.";
        toast.error(message);
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});

    const result = onboardSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !fieldErrors[field as keyof OnboardFormData]) {
          fieldErrors[field as keyof OnboardFormData] = issue.message;
        }
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!companyId) {
        await createCompanyAndBrand();
      }
      const data = result.data;

      await updateBrandConfig({
        industry: data.industry,
        target_audience: data.targetAudience,
        unique_selling_point: data.uniqueSellingPoint,
        tone: data.tone,
        brand_voice_doc: data.brandVoiceDoc,
        topics_to_cover: data.topicsToCover,
        topics_to_avoid: data.topicsToAvoid,
        competitor_handles: data.competitorHandles,
        primary_color: data.primaryColor,
        secondary_color: data.secondaryColor,
        accent_color: data.accentColor,
        logo_url: data.logoUrl,
        image_style: data.imageStyle,
        active_platforms: data.activePlatforms,
        post_frequency: data.postFrequency,
        preferred_times: data.preferredTimes,
        timezone: data.timezone,
        promotional_pct: data.promotionalPct,
        educational_pct: data.educationalPct,
        engagement_pct: data.engagementPct,
      });

      setSuccessSlug(data.slug);
      toast.success("Client setup completed.");
      router.push(`/admin/clients/${data.slug}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to finish setup.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (successSlug) {
    return (
      <Card className="rounded-xl border border-tbc-red/30 bg-white shadow-sm">
        <CardContent className="flex flex-col items-start gap-6 px-8 py-12">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-tbc-red" />
            <div>
              <h2 className="text-2xl font-bold text-navy">
                Client onboarded successfully
              </h2>
              <p className="mt-1 text-text-muted">
                {form.companyName} is ready in Autopilot.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
            <p className="text-sm text-text-muted">Dashboard URL</p>
            <p className="font-mono text-navy">
              dashboard.autopilot.ai/{successSlug}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-tbc-red hover:bg-tbc-red-hover">
              <Link href={`/dashboard/${successSlug}`}>Open dashboard</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSuccessSlug(null);
                setForm(defaultOnboardValues);
                setSlugEdited(false);
                setCurrentStep(1);
              }}
            >
              Onboard another client
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <HorizontalStepper
        steps={steps}
        currentStep={currentStep}
        onStepClick={goToStep}
      />

      <div className="space-y-6">
      {currentStep === 1 && (
      <StepSection
        title="Company Details"
        description="Basic information about the client and their market position."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(event) => handleCompanyNameChange(event.target.value)}
              placeholder="Acme Building Supplies"
            />
            {errors.companyName && (
              <p className="text-sm text-red-600">{errors.companyName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={(event) => updateField("ownerEmail", event.target.value)}
              placeholder="owner@company.com"
            />
            {errors.ownerEmail && (
              <p className="text-sm text-red-600">{errors.ownerEmail}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={form.slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            placeholder="acme-building-supplies"
          />
          <p className="text-sm text-[#9ca3af] dark:text-slate-500">
            Preview:{" "}
            <span className="font-mono text-[#0D9488]">
              dashboard.autopilot.ai/{form.slug || "your-slug"}
            </span>
          </p>
          {errors.slug && (
            <p className="text-sm text-red-600">{errors.slug}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <TagInput
            value={form.industry}
            onChange={(value) => updateField("industry", value)}
            placeholder="e.g. Construction, Home Improvement, Retail"
            suggestions={INDUSTRY_SUGGESTIONS}
          />
          <p className="text-xs text-[#9ca3af] dark:text-slate-500">
            Add all categories that apply - many businesses span multiple
            industries
          </p>
          {errors.industry && (
            <p className="text-sm text-red-600">{errors.industry}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetAudience">Target audience</Label>
          <Textarea
            id="targetAudience"
            value={form.targetAudience}
            onChange={(event) =>
              updateField("targetAudience", event.target.value)
            }
            rows={4}
            placeholder="e.g. Homeowners and contractors in Jamaica looking to upgrade to hurricane-resistant, energy-efficient windows and doors. Includes both residential property owners renovating their homes and commercial developers on new builds."
          />
          <p className="text-xs text-[#9ca3af] dark:text-slate-500">
            Be specific - who are they, where are they, what do they care about?
          </p>
          {errors.targetAudience && (
            <p className="text-sm text-red-600">{errors.targetAudience}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="uniqueSellingPoint">Unique selling point</Label>
          <Textarea
            id="uniqueSellingPoint"
            value={form.uniqueSellingPoint}
            onChange={(event) =>
              updateField("uniqueSellingPoint", event.target.value)
            }
            rows={4}
            placeholder="e.g. Caribbean-engineered uPVC windows and doors built to withstand hurricane conditions, reduce energy costs through heat reflection, and require zero maintenance compared to aluminum or steel."
          />
          <p className="text-xs text-[#9ca3af] dark:text-slate-500">
            What makes you different from competitors? Be concrete - avoid
            generic claims like &apos;quality&apos; or &apos;great service&apos;.
          </p>
          {errors.uniqueSellingPoint && (
            <p className="text-sm text-red-600">{errors.uniqueSellingPoint}</p>
          )}
        </div>
      </StepSection>
      )}

      {currentStep === 2 && companyId ? (
        <ConnectAccountsStep
          companyId={companyId}
          companyName={form.companyName}
        />
      ) : null}

      {currentStep === 3 && (
      <StepSection
        title="Brand Voice"
        description="Define how this brand communicates on social media."
      >
        <div className="space-y-3">
          <Label>Tone</Label>
          <RadioCards
            options={TONES}
            value={form.tone}
            onChange={(value) => updateField("tone", value)}
            descriptions={TONE_DESCRIPTIONS}
          />
          {errors.tone && (
            <p className="text-sm text-red-600">{errors.tone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="brandVoiceDoc">Brand voice document</Label>
          <Textarea
            id="brandVoiceDoc"
            value={form.brandVoiceDoc}
            onChange={(event) => updateField("brandVoiceDoc", event.target.value)}
            rows={8}
            placeholder="Describe how this brand speaks, what it stands for, and how it should sound on social media..."
          />
          {errors.brandVoiceDoc && (
            <p className="text-sm text-red-600">{errors.brandVoiceDoc}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Topics to cover</Label>
            <TagInput
              value={form.topicsToCover}
              onChange={(value) => updateField("topicsToCover", value)}
              placeholder="Type a topic and press Enter"
            />
            {errors.topicsToCover && (
              <p className="text-sm text-red-600">{errors.topicsToCover}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Topics to avoid</Label>
            <TagInput
              value={form.topicsToAvoid}
              onChange={(value) => updateField("topicsToAvoid", value)}
              placeholder="Type a topic and press Enter"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Competitor handles</Label>
          <TagInput
            value={form.competitorHandles}
            onChange={(value) => updateField("competitorHandles", value)}
            placeholder="Type handle and press Enter"
            prefix="@"
          />
        </div>
      </StepSection>
      )}

      {currentStep === 4 && (
      <StepSection
        title="Visual Identity"
        description="Colors, logo, platforms, and posting cadence."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <ColorField
            label="Primary color"
            value={form.primaryColor}
            onChange={(value) => updateField("primaryColor", value)}
            error={errors.primaryColor}
          />
          <ColorField
            label="Secondary color"
            value={form.secondaryColor}
            onChange={(value) => updateField("secondaryColor", value)}
            error={errors.secondaryColor}
          />
          <ColorField
            label="Accent color"
            value={form.accentColor}
            onChange={(value) => updateField("accentColor", value)}
            error={errors.accentColor}
          />
        </div>

        <div className="space-y-2">
          <Label>Logo upload</Label>
          <AssetUploader
            value={form.logoUrl}
            onChange={(url) => updateField("logoUrl", url)}
            slug={form.slug || "draft"}
          />
        </div>

        <div className="space-y-3">
          <Label>Image style</Label>
          <RadioCards
            options={IMAGE_STYLES}
            value={form.imageStyle}
            onChange={(value) => updateField("imageStyle", value)}
          />
          {errors.imageStyle && (
            <p className="text-sm text-red-600">{errors.imageStyle}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Post frequency</Label>
            <span className="text-sm font-semibold text-[#0D9488]">
              {form.postFrequency} posts / week
            </span>
          </div>
          <Slider
            min={3}
            max={7}
            step={1}
            value={[form.postFrequency]}
            onValueChange={([value]) => updateField("postFrequency", value)}
          />
        </div>

        <div className="space-y-3">
          <Label>Active platforms</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORMS.map((platform) => {
              const checked = form.activePlatforms.includes(platform);
              return (
                <label
                  key={platform}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3",
                    checked
                      ? "border-[#0D9488] bg-[#0D9488]/5"
                      : "border-slate-200"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => togglePlatform(platform)}
                  />
                  <span className="font-medium text-[#0B1C3D]">{platform}</span>
                </label>
              );
            })}
          </div>
          {errors.activePlatforms && (
            <p className="text-sm text-red-600">{errors.activePlatforms}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={form.timezone}
            onValueChange={(value) => updateField("timezone", value)}
          >
            <SelectTrigger id="timezone" className="max-w-md">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((timezone) => (
                <SelectItem key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </StepSection>
      )}

      {currentStep === 5 && (
      <StepSection
        title="Content Mix"
        description="Balance promotional, educational, and engagement content."
      >
        <div className="rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Percentages always total{" "}
          <span
            className={cn(
              "font-semibold",
              contentMixTotal === 100 ? "text-[#0D9488]" : "text-red-600"
            )}
          >
            {contentMixTotal}%
          </span>
          . Adjusting one slider redistributes the others proportionally.
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {(
            [
              ["promotionalPct", "Promotional", form.promotionalPct],
              ["educationalPct", "Educational", form.educationalPct],
              ["engagementPct", "Engagement", form.engagementPct],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{label}</Label>
                <span className="text-sm font-semibold text-[#0B9488]">
                  {value}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[value]}
                onValueChange={([next]) => handleContentMixChange(key, next)}
              />
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-4">
          <Label>Preferred posting times</Label>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {form.activePlatforms.map((platform) => (
              <div key={platform} className="space-y-2">
                <Label htmlFor={`time-${platform}`}>{platform}</Label>
                <Input
                  id={`time-${platform}`}
                  type="time"
                  value={form.preferredTimes[platform] ?? "09:00"}
                  onChange={(event) =>
                    updateField("preferredTimes", {
                      ...form.preferredTimes,
                      [platform]: event.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
          {errors.preferredTimes && (
            <p className="text-sm text-red-600">{errors.preferredTimes}</p>
          )}
        </div>
      </StepSection>
      )}

      <div className="flex items-center justify-between border-t border-border pt-6">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}
          >
            Back
          </Button>
        ) : (
          <div />
        )}

        {currentStep < 5 ? (
          <Button
            type="button"
            className="bg-tbc-red hover:bg-tbc-red-hover"
            disabled={isSubmitting}
            onClick={() => void handleNext()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Next"
            )}
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[160px] bg-tbc-red hover:bg-tbc-red-hover"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finishing setup...
              </>
            ) : (
              "Finish Setup"
            )}
          </Button>
        )}
      </div>
      </div>
    </form>
  );
}
