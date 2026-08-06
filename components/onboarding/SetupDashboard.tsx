"use client";

import {
  AlertCircle,
  CheckCircle,
  Circle,
  Loader2,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ZodError } from "zod";

import { AssetUploader } from "@/components/onboarding/AssetUploader";
import { CatalogueTab } from "@/components/onboarding/CatalogueTab";
import {
  BrandHelperModal,
  BrandHelperTriggerButton,
} from "@/components/onboarding/BrandHelperModal";
import { ConnectAccountsStep } from "@/components/onboarding/ConnectAccountsStep";
import { TagInput, type TagInputHandle } from "@/components/onboarding/TagInput";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { requestAdminApi } from "@/lib/onboarding/admin-api";
import { isCatalogueIndustryEligible } from "@/lib/onboarding/catalogue-industries";
import {
  calculateCompleteness,
  hasZernioConnectedAccount,
  parsePreferredTimes,
  type SectionStatus,
} from "@/lib/onboarding/completeness";
import {
  mergeSectionsConfirmed,
  parseSectionsConfirmed,
  type SectionConfirmKey,
  type SectionsConfirmed,
} from "@/lib/onboarding/sections-confirmed";
import type { BrandConfig, Company, Json } from "@/lib/supabase/types";
import type { BrandHelperApplyUpdates } from "@/lib/types/brand-helper";
import { cn } from "@/lib/utils";
import { normalizeIndustries, normalizePlatforms, normalizeStringArray } from "@/lib/validations/brand-config-normalize";
import {
  buildVisualAudienceProfileForSave,
  defaultVisualAudienceProfile,
  parseVisualAudienceProfile,
  type VisualAudienceDemographic,
} from "@/lib/validations/visual-audience";
import {
  adjustContentMix,
  defaultOnboardValues,
  IMAGE_STYLES,
  INDUSTRY_SUGGESTIONS,
  PLATFORMS,
  setupBrandVoiceSchema,
  setupConnectSchema,
  setupContentMixSchema,
  setupCompanyDetailsSchema,
  setupVisualIdentitySchema,
  TIMEZONES,
  TONES,
  type OnboardFormData,
} from "@/lib/validations/onboard";

const TONE_DESCRIPTIONS: Record<(typeof TONES)[number], string> = {
  Professional: "Polished, authoritative, and industry-leading.",
  Casual: "Friendly, approachable, and conversational.",
  Playful: "Light-hearted, witty, and engaging.",
  Bold: "Confident, direct, and attention-grabbing.",
};

type SetupTab =
  | "company-details"
  | "connect-accounts"
  | "brand-voice"
  | "visual-identity"
  | "content-mix"
  | "menu-hours";

type SetupFormState = OnboardFormData & {
  visualAudienceDemographic: VisualAudienceDemographic;
  visualAudienceLocalPct: number;
};

const VISUAL_AUDIENCE_OPTIONS: {
  value: VisualAudienceDemographic;
  label: string;
  subtext: string;
}[] = [
  {
    value: "local",
    label: "Local",
    subtext: "Predominantly local Jamaican audience",
  },
  {
    value: "tourist",
    label: "Tourist / international",
    subtext: "Visitors and international customers",
  },
  {
    value: "mixed",
    label: "Mixed",
    subtext: "Both locals and tourists",
  },
];

type FieldErrors = Partial<
  Record<keyof SetupFormState | "form" | "visualAudienceProfile", string>
>;

function SectionStatusIcon({ status }: { status: SectionStatus }) {
  if (status === "complete") {
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  }
  if (status === "partial") {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  }
  return <Circle className="h-4 w-4 text-[#374151] dark:text-slate-300" />;
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
                : "border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] hover:border-[#0D9488]/40"
            )}
          >
            <p className="font-semibold text-[#111111] dark:text-white">{option}</p>
            {descriptions?.[option] ? (
              <p className="mt-1 text-sm text-[#9ca3af] dark:text-slate-500">
                {descriptions[option]}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TabSaveButton({
  saving,
  onClick,
}: {
  saving: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-end border-t border-border pt-4">
      <Button
        type="button"
        className="bg-tbc-red hover:bg-tbc-red-hover"
        disabled={saving}
        onClick={onClick}
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </Button>
    </div>
  );
}

function parseVisualReferences(value: Json | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (value && typeof value === "object") {
    return Object.values(value).filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
  }

  return [];
}

function buildConnectAccountsConfirmed(
  brandConfig: BrandConfig | null,
  localConfirmed: SectionsConfirmed
): SectionsConfirmed {
  return {
    ...parseSectionsConfirmed(brandConfig?.sections_confirmed),
    ...localConfirmed,
    connectAccounts: hasZernioConnectedAccount(brandConfig),
  };
}

function mapBrandToForm(
  company: Company,
  brand: BrandConfig,
  current: SetupFormState
): SetupFormState {
  const visualAudienceProfile = parseVisualAudienceProfile(
    brand.visual_audience_profile
  );

  return {
    ...current,
    companyName: company.name,
    slug: company.slug,
    ownerEmail: company.owner_email,
    industry: normalizeIndustries(brand.industry),
    targetAudience: brand.target_audience ?? "",
    uniqueSellingPoint: brand.unique_selling_point ?? "",
    visualAudienceDemographic: visualAudienceProfile.demographic,
    visualAudienceLocalPct:
      visualAudienceProfile.demographic === "mixed"
        ? visualAudienceProfile.local_pct
        : defaultVisualAudienceProfile.local_pct,
    tone: (brand.tone as OnboardFormData["tone"]) ?? current.tone,
    brandVoiceDoc: brand.brand_voice_doc ?? "",
    topicsToCover: normalizeStringArray(brand.topics_to_cover),
    topicsToAvoid: normalizeStringArray(brand.topics_to_avoid),
    competitorHandles: normalizeStringArray(brand.competitor_handles),
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
    preferredTimes: parsePreferredTimes(brand.preferred_times),
  };
}

export function SetupDashboard({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [form, setForm] = useState<SetupFormState>({
    ...defaultOnboardValues,
    visualAudienceDemographic: defaultVisualAudienceProfile.demographic,
    visualAudienceLocalPct: 70,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [savingTab, setSavingTab] = useState<SetupTab | "launch" | null>(null);
  const [activeTab, setActiveTab] = useState<SetupTab>("company-details");
  const [refreshKey, setRefreshKey] = useState(0);
  const [connectUiRevealed, setConnectUiRevealed] = useState(false);
  const [localSectionsConfirmed, setLocalSectionsConfirmed] =
    useState<SectionsConfirmed>({});
  const [brandHelperOpen, setBrandHelperOpen] = useState(false);
  const [visualRefs, setVisualRefs] = useState<string[]>([]);
  const [newVisualRef, setNewVisualRef] = useState("");
  const [extractingColors, setExtractingColors] = useState(false);

  const formRef = useRef(form);
  const industryTagsRef = useRef<TagInputHandle>(null);
  const topicsToCoverTagsRef = useRef<TagInputHandle>(null);
  const topicsToAvoidTagsRef = useRef<TagInputHandle>(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const persistedPlatforms = useMemo(
    () => (brand ? normalizePlatforms(brand.active_platforms) : []),
    [brand]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await requestAdminApi<{
        company: Company;
        brand: BrandConfig | null;
      }>(`/api/admin/onboard/company?companyId=${companyId}`);

      setCompany(result.company);
      setBrand(result.brand);
      if (result.brand) {
        setForm((current) => mapBrandToForm(result.company, result.brand!, current));
        setVisualRefs(parseVisualReferences(result.brand.visual_references));
      } else {
        setForm((current) => ({
          ...current,
          companyName: result.company.name,
          slug: result.company.slug,
          ownerEmail: result.company.owner_email,
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load client.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey]);

  useEffect(() => {
    if (!brand?.sections_confirmed) {
      return;
    }

    const fromDb = parseSectionsConfirmed(brand.sections_confirmed);
    if (Object.keys(fromDb).length === 0) {
      return;
    }

    setLocalSectionsConfirmed((current) => ({ ...current, ...fromDb }));
  }, [brand?.id, brand?.sections_confirmed]);

  useEffect(() => {
    if (persistedPlatforms.length > 0) {
      setConnectUiRevealed(true);
    }
  }, [persistedPlatforms.length, brand?.id]);

  const handleAccountsUpdated = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  const confirmSection = useCallback((section: SectionConfirmKey) => {
    setLocalSectionsConfirmed((current) => ({
      ...current,
      [section]: true,
    }));
  }, []);

  const brandForCompleteness = useMemo((): BrandConfig | null => {
    if (!brand) {
      return null;
    }

    const confirmed: SectionsConfirmed = {
      ...parseSectionsConfirmed(brand.sections_confirmed),
      ...localSectionsConfirmed,
    };

    return {
      ...brand,
      industry: normalizeIndustries(form.industry),
      target_audience: form.targetAudience,
      unique_selling_point: form.uniqueSellingPoint,
      tone: form.tone,
      brand_voice_doc: form.brandVoiceDoc,
      topics_to_cover: normalizeStringArray(form.topicsToCover),
      topics_to_avoid: normalizeStringArray(form.topicsToAvoid),
      competitor_handles: normalizeStringArray(form.competitorHandles),
      primary_color: form.primaryColor,
      secondary_color: form.secondaryColor,
      accent_color: form.accentColor,
      image_style: form.imageStyle,
      promotional_pct: form.promotionalPct,
      educational_pct: form.educationalPct,
      engagement_pct: form.engagementPct,
      post_frequency: form.postFrequency,
      sections_confirmed: confirmed as Json,
    };
  }, [brand, form, localSectionsConfirmed]);

  const companyForCompleteness = useMemo((): Company => {
    if (!company) {
      return {
        id: companyId,
        name: form.companyName,
        slug: form.slug,
        owner_email: form.ownerEmail,
        status: "setup",
        plan: "standard",
        created_at: "",
      };
    }

    return {
      ...company,
      name: form.companyName,
      slug: form.slug,
      owner_email: form.ownerEmail,
    };
  }, [company, companyId, form.companyName, form.slug, form.ownerEmail]);

  const completeness = useMemo(
    () => calculateCompleteness(companyForCompleteness, brandForCompleteness),
    [companyForCompleteness, brandForCompleteness]
  );

  const connectAccountsWarning = useMemo(() => {
    if (persistedPlatforms.length === 0) {
      return null;
    }

    return hasZernioConnectedAccount(brand)
      ? null
      : "Select platforms and connect at least one account to complete this section.";
  }, [persistedPlatforms.length, brand]);

  const contentMixTotal = useMemo(
    () => form.promotionalPct + form.educationalPct + form.engagementPct,
    [form.promotionalPct, form.educationalPct, form.engagementPct]
  );

  const showCatalogueTab = useMemo(
    () => isCatalogueIndustryEligible(normalizeIndustries(form.industry)),
    [form.industry]
  );

  async function confirmConnectAccountsSection() {
    try {
      const latest = await requestAdminApi<{
        company: Company;
        brand: BrandConfig | null;
      }>(`/api/admin/onboard/company?companyId=${companyId}`);

      const latestBrand = latest.brand;
      if (!latestBrand) {
        return;
      }

      const hasConnectedAccount = hasZernioConnectedAccount(latestBrand);
      if (!hasConnectedAccount) {
        return;
      }

      const updated = await requestAdminApi<BrandConfig>(
        `/api/admin/brand-config/${companyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sections_confirmed: buildConnectAccountsConfirmed(
              latestBrand,
              localSectionsConfirmed
            ),
          }),
        }
      );

      setBrand((current) =>
        current
          ? {
              ...current,
              ...updated,
              industry: normalizeIndustries(updated.industry),
              topics_to_cover: normalizeStringArray(updated.topics_to_cover),
              topics_to_avoid: normalizeStringArray(updated.topics_to_avoid),
              competitor_handles: normalizeStringArray(
                updated.competitor_handles
              ),
            }
          : updated
      );
      confirmSection("connectAccounts");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update setup progress."
      );
    }
  }

  async function confirmCatalogueSection() {
    try {
      const updated = await requestAdminApi<BrandConfig>(
        `/api/admin/brand-config/${companyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sections_confirmed: mergeSectionsConfirmed(
              {
                ...parseSectionsConfirmed(brand?.sections_confirmed),
                ...localSectionsConfirmed,
              },
              "catalogue"
            ),
          }),
        }
      );

      setBrand((current) =>
        current
          ? {
              ...current,
              ...updated,
              industry: normalizeIndustries(updated.industry),
              topics_to_cover: normalizeStringArray(updated.topics_to_cover),
              topics_to_avoid: normalizeStringArray(updated.topics_to_avoid),
              competitor_handles: normalizeStringArray(
                updated.competitor_handles
              ),
            }
          : updated
      );
      confirmSection("catalogue");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update setup progress."
      );
    }
  }

  function updateField<K extends keyof SetupFormState>(
    key: K,
    value: SetupFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function applyErrors(result: { success: false; error: ZodError }) {
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field as keyof OnboardFormData]) {
        fieldErrors[field as keyof OnboardFormData] = issue.message;
      }
    }
    setErrors(fieldErrors);
    toast.error("Please fix the highlighted fields before saving.");
  }

  function handleBrandHelperApply(updates: BrandHelperApplyUpdates) {
    setForm((current) => ({
      ...current,
      ...(updates.uniqueSellingPoint
        ? { uniqueSellingPoint: updates.uniqueSellingPoint }
        : {}),
      ...(updates.targetAudience
        ? { targetAudience: updates.targetAudience }
        : {}),
      ...(updates.brandVoiceDoc
        ? { brandVoiceDoc: updates.brandVoiceDoc }
        : {}),
      ...(updates.tone ? { tone: updates.tone } : {}),
      ...(updates.topicsToCover
        ? {
            topicsToCover: Array.from(
              new Set([...current.topicsToCover, ...updates.topicsToCover])
            ),
          }
        : {}),
    }));
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

  async function saveCompanyDetails() {
    const industry = normalizeIndustries(
      industryTagsRef.current?.flushPendingInput() ?? formRef.current.industry
    );
    const snapshot = { ...formRef.current, industry };

    const parsed = setupCompanyDetailsSchema.safeParse({
      companyName: snapshot.companyName,
      ownerEmail: snapshot.ownerEmail,
      industry: snapshot.industry,
      targetAudience: snapshot.targetAudience,
      uniqueSellingPoint: snapshot.uniqueSellingPoint,
      visualAudienceProfile: buildVisualAudienceProfileForSave(
        snapshot.visualAudienceDemographic,
        snapshot.visualAudienceLocalPct
      ),
    });

    if (!parsed.success) {
      applyErrors(parsed);
      return;
    }

    setSavingTab("company-details");
    try {
      const result = await requestAdminApi<{
        company: Company;
        brand: BrandConfig;
      }>("/api/admin/onboard/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          ...parsed.data,
        }),
      });
      setCompany(result.company);
      setBrand((current) =>
        current
          ? {
              ...current,
              industry: parsed.data.industry,
              target_audience: parsed.data.targetAudience,
              unique_selling_point: parsed.data.uniqueSellingPoint,
              visual_audience_profile: parsed.data.visualAudienceProfile,
            }
          : result.brand
      );
      confirmSection("companyDetails");
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveBrandConfig(
    tab: SetupTab,
    sectionKey: SectionConfirmKey | null,
    fields: Record<string, unknown>,
    schema: {
      safeParse: (
        value: unknown
      ) =>
        | { success: true; data: unknown }
        | { success: false; error: ZodError };
    },
    formSlice: Record<string, unknown>
  ) {
    const parsed = schema.safeParse(formSlice);
    if (!parsed.success) {
      applyErrors(parsed);
      return;
    }

    setSavingTab(tab);
    try {
      const payload =
        sectionKey !== null
          ? {
              ...fields,
              sections_confirmed: mergeSectionsConfirmed(
                {
                  ...parseSectionsConfirmed(brand?.sections_confirmed),
                  ...localSectionsConfirmed,
                },
                sectionKey
              ),
            }
          : fields;

      const updated = await requestAdminApi<BrandConfig>(
        `/api/admin/brand-config/${companyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setBrand((current) =>
        current
          ? {
              ...current,
              ...updated,
              industry: normalizeIndustries(updated.industry),
              topics_to_cover: normalizeStringArray(updated.topics_to_cover),
              topics_to_avoid: normalizeStringArray(updated.topics_to_avoid),
              competitor_handles: normalizeStringArray(updated.competitor_handles),
            }
          : updated
      );
      if (sectionKey !== null) {
        confirmSection(sectionKey);
      }
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveConnectAccounts() {
    const parsed = setupConnectSchema.safeParse({
      activePlatforms: form.activePlatforms,
    });

    if (!parsed.success) {
      applyErrors(parsed);
      return;
    }

    setSavingTab("connect-accounts");
    try {
      const payload: Record<string, unknown> = {
        active_platforms: parsed.data.activePlatforms,
        sections_confirmed: buildConnectAccountsConfirmed(
          brand,
          localSectionsConfirmed
        ),
      };

      const updated = await requestAdminApi<BrandConfig>(
        `/api/admin/brand-config/${companyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setBrand(updated);
      if (hasZernioConnectedAccount(updated)) {
        confirmSection("connectAccounts");
      } else {
        setLocalSectionsConfirmed((current) => ({
          ...current,
          connectAccounts: false,
        }));
      }
      setConnectUiRevealed(true);
      toast.success("Saved");
      setRefreshKey((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSavingTab(null);
    }
  }

  async function saveBrandVoice() {
    const topicsToCover =
      topicsToCoverTagsRef.current?.flushPendingInput() ??
      normalizeStringArray(formRef.current.topicsToCover);
    const topicsToAvoid =
      topicsToAvoidTagsRef.current?.flushPendingInput() ??
      normalizeStringArray(formRef.current.topicsToAvoid);
    const snapshot = {
      ...formRef.current,
      topicsToCover,
      topicsToAvoid,
    };

    await saveBrandConfig(
      "brand-voice",
      "brandVoice",
      {
        tone: snapshot.tone,
        brand_voice_doc: snapshot.brandVoiceDoc,
        topics_to_cover: normalizeStringArray(snapshot.topicsToCover),
        topics_to_avoid: normalizeStringArray(snapshot.topicsToAvoid),
        competitor_handles: normalizeStringArray(snapshot.competitorHandles),
      },
      setupBrandVoiceSchema,
      {
        tone: snapshot.tone,
        brandVoiceDoc: snapshot.brandVoiceDoc,
        topicsToCover: snapshot.topicsToCover,
        topicsToAvoid: snapshot.topicsToAvoid,
        competitorHandles: snapshot.competitorHandles,
      }
    );
  }

  async function saveVisualIdentity() {
    await saveBrandConfig(
      "visual-identity",
      "visualIdentity",
      {
        primary_color: form.primaryColor,
        secondary_color: form.secondaryColor,
        accent_color: form.accentColor,
        logo_url: form.logoUrl,
        image_style: form.imageStyle,
        visual_references: visualRefs,
      },
      setupVisualIdentitySchema,
      {
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        logoUrl: form.logoUrl,
        imageStyle: form.imageStyle,
      }
    );
  }

  async function extractColorsFromLogo() {
    if (!form.logoUrl) {
      return;
    }

    setExtractingColors(true);

    try {
      const response = await fetch("/api/admin/extract-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: form.logoUrl }),
      });

      const result = (await response.json()) as {
        data: {
          primary_color: string;
          secondary_color: string;
          accent_color: string;
          color_notes: string;
        } | null;
        error: string | null;
      };

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to extract colors.");
      }

      const colors = result.data;
      updateField("primaryColor", colors.primary_color);
      updateField("secondaryColor", colors.secondary_color);
      updateField("accentColor", colors.accent_color);
      toast.success("Colors extracted. Review and save when ready.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract colors.";
      toast.error(message);
    } finally {
      setExtractingColors(false);
    }
  }

  async function saveContentMix() {
    await saveBrandConfig(
      "content-mix",
      "contentMix",
      {
        post_frequency: form.postFrequency,
        promotional_pct: form.promotionalPct,
        educational_pct: form.educationalPct,
        engagement_pct: form.engagementPct,
        preferred_times: form.preferredTimes,
        timezone: form.timezone,
      },
      setupContentMixSchema,
      {
        postFrequency: form.postFrequency,
        promotionalPct: form.promotionalPct,
        educationalPct: form.educationalPct,
        engagementPct: form.engagementPct,
        preferredTimes: form.preferredTimes,
        timezone: form.timezone,
        activePlatforms: form.activePlatforms,
      }
    );
  }

  async function handleLaunch() {
    if (!completeness.canLaunch) {
      toast.error("Complete more sections before launching this client.");
      return;
    }

    setSavingTab("launch");
    try {
      const result = await requestAdminApi<{ company: Company }>(
        "/api/admin/onboard/company",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, launch: true }),
        }
      );
      toast.success("Client launched successfully.");
      router.push(`/admin/clients/${result.company.slug}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to launch.");
    } finally {
      setSavingTab(null);
    }
  }

  if (loading && !company) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading setup dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Input
            value={form.companyName}
            onChange={(event) => updateField("companyName", event.target.value)}
            className="max-w-xl border-0 px-0 text-2xl font-bold text-[#111111] dark:text-white shadow-none focus-visible:ring-0"
            aria-label="Company name"
          />
          <Badge variant="outline" className="font-mono">
            {form.slug}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">
            Setup Progress: {completeness.percent}% complete
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#1a1a2e]">
          <div
            className="h-full rounded-full bg-tbc-red transition-all"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        {connectAccountsWarning ? (
          <p className="text-sm text-amber-500">{connectAccountsWarning}</p>
        ) : null}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SetupTab)}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white dark:bg-[#161616] p-1">
          <TabsTrigger value="company-details" className="gap-2">
            <SectionStatusIcon status={completeness.sections.companyDetails} />
            Company Details
          </TabsTrigger>
          <TabsTrigger value="connect-accounts" className="gap-2">
            <SectionStatusIcon status={completeness.sections.connectAccounts} />
            Connect Accounts
          </TabsTrigger>
          <TabsTrigger value="brand-voice" className="gap-2">
            <SectionStatusIcon status={completeness.sections.brandVoice} />
            Brand Voice
          </TabsTrigger>
          <TabsTrigger value="visual-identity" className="gap-2">
            <SectionStatusIcon status={completeness.sections.visualIdentity} />
            Visual Identity
          </TabsTrigger>
          <TabsTrigger value="content-mix" className="gap-2">
            <SectionStatusIcon status={completeness.sections.contentMix} />
            Content Mix
          </TabsTrigger>
          {showCatalogueTab ? (
            <TabsTrigger value="menu-hours" className="gap-2">
              <SectionStatusIcon status={completeness.sections.catalogue} />
              Menu &amp; Hours
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="company-details" className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm">
          <div className="flex justify-end">
            <BrandHelperTriggerButton onClick={() => setBrandHelperOpen(true)} />
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
            {errors.ownerEmail ? (
              <p className="text-sm text-red-600">{errors.ownerEmail}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="industry">Industry</Label>
            <TagInput
              ref={industryTagsRef}
              value={form.industry}
              onChange={(value) => updateField("industry", value)}
              placeholder="e.g. Construction, Home Improvement, Retail"
              suggestions={INDUSTRY_SUGGESTIONS}
            />
            <p className="text-xs text-[#9ca3af] dark:text-slate-500">
              Add all categories that apply - many businesses span multiple
              industries
            </p>
            {errors.industry ? (
              <p className="text-sm text-red-600">{errors.industry}</p>
            ) : null}
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
            {errors.targetAudience ? (
              <p className="text-sm text-red-600">{errors.targetAudience}</p>
            ) : null}
          </div>

          <div className="space-y-4 rounded-lg border border-[#E5E7EB] dark:border-[#2a2a2a] p-4">
            <div>
              <Label>Visual audience profile</Label>
              <p className="mt-1 text-xs text-[#9ca3af] dark:text-slate-500">
                Tells the AI what kind of people to show in generated images.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Primary demographic
              </Label>
              <div className="grid gap-3 md:grid-cols-3">
                {VISUAL_AUDIENCE_OPTIONS.map((option) => {
                  const selected = form.visualAudienceDemographic === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        updateField("visualAudienceDemographic", option.value)
                      }
                      className={cn(
                        "rounded-lg border p-4 text-left transition-all",
                        selected
                          ? "border-[#0D9488] bg-[#0D9488]/5 ring-2 ring-[#0D9488]/30"
                          : "border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] hover:border-[#0D9488]/40"
                      )}
                    >
                      <p className="font-semibold text-[#111111] dark:text-white">
                        {option.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {option.subtext}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {form.visualAudienceDemographic === "mixed" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
                  <span>100% local</span>
                  <Label className="text-sm font-medium text-slate-700">
                    Local vs tourist split
                  </Label>
                  <span>100% tourist</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={10}
                  value={[form.visualAudienceLocalPct]}
                  onValueChange={([next]) =>
                    updateField("visualAudienceLocalPct", next)
                  }
                />
                <p className="text-sm text-slate-600">
                  {form.visualAudienceLocalPct}% local /{" "}
                  {100 - form.visualAudienceLocalPct}% tourist
                </p>
              </div>
            ) : null}
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
            {errors.uniqueSellingPoint ? (
              <p className="text-sm text-red-600">{errors.uniqueSellingPoint}</p>
            ) : null}
          </div>

          <TabSaveButton
            saving={savingTab === "company-details"}
            onClick={() => void saveCompanyDetails()}
          />
        </TabsContent>

        <TabsContent value="connect-accounts" className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm">
          <div className="space-y-3">
            <Label>Active platforms</Label>
            <p className="text-sm text-text-muted">
              Choose which platforms this client will use. Save your selection
              before connecting accounts.
            </p>
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
                        : "border-[#E5E7EB] dark:border-[#2a2a2a]"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePlatform(platform)}
                    />
                    <span className="font-medium text-[#374151] dark:text-slate-300">{platform}</span>
                  </label>
                );
              })}
            </div>
            {errors.activePlatforms ? (
              <p className="text-sm text-red-600">{errors.activePlatforms}</p>
            ) : null}
          </div>

          <TabSaveButton
            saving={savingTab === "connect-accounts"}
            onClick={() => void saveConnectAccounts()}
          />

          {connectAccountsWarning ? (
            <p className="text-sm text-amber-500">{connectAccountsWarning}</p>
          ) : null}

          {connectUiRevealed ? (
            <div className="space-y-4 border-t border-border pt-6">
              <div>
                <h3 className="text-lg font-semibold text-[#111111] dark:text-white">
                  Connect Accounts
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Link social accounts for automated publishing on your selected
                  platforms.
                </p>
              </div>

              {persistedPlatforms.length > 0 ? (
                <ConnectAccountsStep
                  companyId={companyId}
                  companyName={form.companyName}
                  activePlatforms={persistedPlatforms}
                  enabled
                  compact
                  onAccountsUpdated={handleAccountsUpdated}
                  onSectionConfirmed={confirmConnectAccountsSection}
                />
              ) : (
                <p className="text-sm text-text-muted">
                  Select at least one platform above to set up connections
                </p>
              )}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="brand-voice" className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm">
          <div className="flex justify-end">
            <BrandHelperTriggerButton onClick={() => setBrandHelperOpen(true)} />
          </div>

          <div className="space-y-3">
            <Label>Tone</Label>
            <RadioCards
              options={TONES}
              value={form.tone}
              onChange={(value) => updateField("tone", value)}
              descriptions={TONE_DESCRIPTIONS}
            />
            {errors.tone ? (
              <p className="text-sm text-red-600">{errors.tone}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandVoiceDoc">Brand voice document</Label>
            <Textarea
              id="brandVoiceDoc"
              value={form.brandVoiceDoc}
              onChange={(event) =>
                updateField("brandVoiceDoc", event.target.value)
              }
              rows={8}
              placeholder="Describe how this brand speaks, what it stands for, and how it should sound on social media..."
            />
            {errors.brandVoiceDoc ? (
              <p className="text-sm text-red-600">{errors.brandVoiceDoc}</p>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Topics to cover</Label>
              <TagInput
                ref={topicsToCoverTagsRef}
                value={form.topicsToCover}
                onChange={(value) => updateField("topicsToCover", value)}
                placeholder="Type a topic and press Enter"
              />
              {errors.topicsToCover ? (
                <p className="text-sm text-red-600">{errors.topicsToCover}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Topics to avoid</Label>
              <TagInput
                ref={topicsToAvoidTagsRef}
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

          <TabSaveButton
            saving={savingTab === "brand-voice"}
            onClick={() => void saveBrandVoice()}
          />
        </TabsContent>

        <TabsContent value="visual-identity" className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm">
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
            <Button
              type="button"
              variant="outline"
              className="border-tbc-red text-tbc-red hover:bg-tbc-red/5 hover:text-tbc-red"
              disabled={!form.logoUrl || extractingColors}
              onClick={() => void extractColorsFromLogo()}
            >
              {extractingColors ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Logo with AI
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            <Label>Image style</Label>
            <RadioCards
              options={IMAGE_STYLES}
              value={form.imageStyle}
              onChange={(value) => updateField("imageStyle", value)}
            />
            {errors.imageStyle ? (
              <p className="text-sm text-red-600">{errors.imageStyle}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
              Visual references
            </label>
            <div className="mb-2 flex flex-wrap gap-2">
              {visualRefs.map((ref, index) => (
                <span
                  key={`${ref}-${index}`}
                  className="flex items-center gap-1.5 rounded-lg border border-[#2e2e5a] bg-[#f8fafc] dark:bg-[#1f1f1f] px-2 py-1 text-xs text-[#374151] dark:text-slate-300"
                >
                  {ref}
                  <button
                    type="button"
                    onClick={() =>
                      setVisualRefs((previous) =>
                        previous.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                  >
                    <X size={10} className="text-[#9ca3af] dark:text-slate-500 hover:text-rose-400" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newVisualRef}
                onChange={(event) => setNewVisualRef(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newVisualRef.trim()) {
                    event.preventDefault();
                    setVisualRefs((previous) => [
                      ...previous,
                      newVisualRef.trim(),
                    ]);
                    setNewVisualRef("");
                  }
                }}
                placeholder="Add a description of your visual style or inspiration URL, press Enter"
                className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-3 py-2 text-sm text-[#374151] dark:text-slate-300 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
              />
              <Button
                type="button"
                className="bg-violet-600 hover:bg-violet-500"
                onClick={() => {
                  if (newVisualRef.trim()) {
                    setVisualRefs((previous) => [
                      ...previous,
                      newVisualRef.trim(),
                    ]);
                    setNewVisualRef("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          <TabSaveButton
            saving={savingTab === "visual-identity"}
            onClick={() => void saveVisualIdentity()}
          />
        </TabsContent>

        <TabsContent value="content-mix" className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm">
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

          <div className="rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-4 py-3 text-sm text-[#9ca3af] dark:text-slate-500">
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
                  <span className="text-sm font-semibold text-[#0D9488]">
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

          <div className="space-y-4">
            <Label>Preferred posting times</Label>
            {form.activePlatforms.length === 0 ? (
              <p className="text-sm text-text-muted">
                Select active platforms in the Connect Accounts tab first.
              </p>
            ) : (
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
            )}
            {errors.preferredTimes ? (
              <p className="text-sm text-red-600">{errors.preferredTimes}</p>
            ) : null}
          </div>

          <TabSaveButton
            saving={savingTab === "content-mix"}
            onClick={() => void saveContentMix()}
          />
        </TabsContent>

        {showCatalogueTab ? (
          <TabsContent
            value="menu-hours"
            className="mt-6 space-y-6 rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6 shadow-sm"
          >
            <CatalogueTab
              companyId={companyId}
              onSectionConfirmed={confirmCatalogueSection}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <BrandHelperModal
        companyId={companyId}
        open={brandHelperOpen}
        onOpenChange={setBrandHelperOpen}
        onApply={handleBrandHelperApply}
      />

      <div className="sticky bottom-0 z-10 -mx-2 border-t border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616]/95 px-2 py-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {completeness.canLaunch ? (
            <p className="text-sm text-text-muted">
              This client is ready to launch.
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              Complete more sections to launch this client (currently{" "}
              {completeness.percent}%)
            </p>
          )}

          {completeness.canLaunch ? (
            <Button
              type="button"
              className="bg-tbc-red hover:bg-tbc-red-hover"
              disabled={savingTab === "launch"}
              onClick={() => void handleLaunch()}
            >
              {savingTab === "launch" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Launch Client
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
