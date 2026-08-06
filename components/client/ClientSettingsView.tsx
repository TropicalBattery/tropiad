"use client";

import {
  Bell,
  Building2,
  Calendar,
  LayoutGrid,
  Loader2,
  Lock,
  Mic2,
  Package,
  Palette,
  Pencil,
  Plus,
  Share2,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { TagInput, type TagInputHandle } from "@/components/onboarding/TagInput";
import { HolidayCalendar } from "@/components/dashboard/HolidayCalendar";
import { ProductPhotoLibrary } from "@/components/dashboard/ProductPhotoLibrary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { BrandConfig, Company, Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { normalizeStringArray } from "@/lib/validations/brand-config-normalize";
import {
  clientBrandVoiceSchema,
  clientCompanyDetailsSchema,
  clientContentPreferencesSchema,
  clientNotificationsSchema,
  clientVisualIdentitySchema,
  IMAGE_STYLE_LABELS,
  IMAGE_STYLES,
  TIMEZONES,
  TONES,
} from "@/lib/validations/client-brand-settings";
import { FREQUENCY_OPTIONS, getPostFrequencyLabel } from "@/lib/validations/post-frequency";
import { adjustContentMix } from "@/lib/validations/onboard";
import {
  buildVisualAudienceProfileForSave,
  defaultVisualAudienceProfile,
  formatVisualAudienceLabel,
  parseVisualAudienceProfile,
  type VisualAudienceDemographic,
} from "@/lib/validations/visual-audience";
import { parseZernioAccountIds, resolveAccountIdForPlatform } from "@/lib/zernio/account-ids";
import { toAccountIdKey, toZernioConnectPlatform } from "@/lib/zernio/platforms";
import type { MergedCompanyHoliday } from "@/lib/data/company-holidays";
import { toast } from "sonner";

const SETTINGS_TABS = [
  { id: "company", label: "Company details", icon: Building2 },
  { id: "brand", label: "Brand voice", icon: Mic2 },
  { id: "visual", label: "Visual identity", icon: Palette },
  { id: "content", label: "Content preferences", icon: LayoutGrid },
  { id: "products", label: "Product library", icon: Package },
  { id: "accounts", label: "Connected accounts", icon: Share2 },
  { id: "holidays", label: "Holidays & occasions", icon: Calendar },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

const VALID_TAB_IDS = new Set<string>(SETTINGS_TABS.map((tab) => tab.id));

function isValidTabId(value: string | null): value is SettingsTabId {
  return value !== null && VALID_TAB_IDS.has(value);
}

const ALL_PLATFORMS = [
  { id: "instagram", label: "Instagram", activeName: "Instagram" },
  { id: "facebook", label: "Facebook", activeName: "Facebook" },
  { id: "tiktok", label: "TikTok", activeName: "TikTok" },
  { id: "twitter", label: "Twitter / X", activeName: "X" },
  { id: "linkedin", label: "LinkedIn", activeName: "LinkedIn" },
  { id: "youtube", label: "YouTube", activeName: "YouTube" },
] as const;

const ZERNIO_CONNECT_PLATFORM_IDS = new Set([
  "instagram",
  "facebook",
  "twitter",
  "linkedin",
]);

function isPlatformActive(
  platformId: string,
  activePlatforms: string[]
): boolean {
  const meta = ALL_PLATFORMS.find((platform) => platform.id === platformId);
  if (!meta) {
    return false;
  }

  const aliases = new Set(
    [platformId, meta.activeName, meta.label].map((value) => value.toLowerCase())
  );

  if (platformId === "twitter") {
    aliases.add("x");
    aliases.add("twitter");
  }

  return activePlatforms.some((platform) =>
    aliases.has(platform.toLowerCase())
  );
}

function isPlatformConnected(
  platformId: string,
  accountIds: ReturnType<typeof parseZernioAccountIds>
): boolean {
  const meta = ALL_PLATFORMS.find((platform) => platform.id === platformId);
  if (!meta) {
    return false;
  }

  return Boolean(resolveAccountIdForPlatform(accountIds, meta.activeName));
}

function getPlatformSortRank(
  platformId: string,
  activePlatforms: string[],
  accountIds: ReturnType<typeof parseZernioAccountIds>
): number {
  const active = isPlatformActive(platformId, activePlatforms);
  const connected = isPlatformConnected(platformId, accountIds);

  if (active && connected) {
    return 0;
  }

  if (active) {
    return 1;
  }

  return 2;
}

const VISUAL_AUDIENCE_OPTIONS: {
  value: VisualAudienceDemographic;
  label: string;
  subtext: string;
}[] = [
  {
    value: "local",
    label: "Local",
    subtext: "Predominantly Jamaican audience",
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

type ClientSettingsViewProps = {
  company: Company;
  brand: BrandConfig;
  initialHolidays?: MergedCompanyHoliday[];
};

type SectionId =
  | "company-details"
  | "brand-voice"
  | "visual-identity"
  | "content-preferences"
  | "connected-accounts"
  | "notifications";

type CompanyDetailsDraft = {
  targetAudience: string;
  uniqueSellingPoint: string;
  visualAudienceDemographic: VisualAudienceDemographic;
  visualAudienceLocalPct: number;
};

type BrandVoiceDraft = {
  tone: (typeof TONES)[number];
  topicsToCover: string[];
  topicsToAvoid: string[];
  brandVoiceDoc: string;
};

type VisualIdentityDraft = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  imageStyle: (typeof IMAGE_STYLES)[number];
  logoUrl: string | null;
};

type ContentPreferencesDraft = {
  postFrequency: number;
  promotionalPct: number;
  educationalPct: number;
  engagementPct: number;
  timezone: string;
};

function parsePreferredTimes(value: Json | null): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function parseVisualReferences(value: Json | null): string[] {
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

function buildDrafts(brand: BrandConfig) {
  const visualAudienceProfile = parseVisualAudienceProfile(
    brand.visual_audience_profile
  );

  return {
    companyDetails: {
      targetAudience: brand.target_audience,
      uniqueSellingPoint: brand.unique_selling_point,
      visualAudienceDemographic: visualAudienceProfile.demographic,
      visualAudienceLocalPct:
        visualAudienceProfile.demographic === "mixed"
          ? visualAudienceProfile.local_pct
          : defaultVisualAudienceProfile.local_pct,
    },
    brandVoice: {
      tone: (brand.tone as (typeof TONES)[number]) ?? "Professional",
      topicsToCover: normalizeStringArray(brand.topics_to_cover),
      topicsToAvoid: normalizeStringArray(brand.topics_to_avoid),
      brandVoiceDoc: brand.brand_voice_doc ?? "",
    },
    visualIdentity: {
      primaryColor: brand.primary_color,
      secondaryColor: brand.secondary_color,
      accentColor: brand.accent_color,
      imageStyle: (brand.image_style as (typeof IMAGE_STYLES)[number]) ?? "Lifestyle",
      logoUrl: brand.logo_url,
    },
    contentPreferences: {
      postFrequency: brand.post_frequency,
      promotionalPct: brand.promotional_pct,
      educationalPct: brand.educational_pct,
      engagementPct: brand.engagement_pct,
      timezone: brand.timezone,
    },
  };
}

function buildNotificationEmailsDraft(
  brand: BrandConfig,
  ownerEmail: string
): string[] {
  const owner = ownerEmail.trim().toLowerCase();

  return (brand.notification_emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email && email !== owner);
}

export function ClientSettingsView({
  company,
  brand: initialBrand,
  initialHolidays,
}: ClientSettingsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const connectedStatus = searchParams.get("connected");
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() =>
    isValidTabId(tabFromUrl) ? tabFromUrl : "company"
  );

  useEffect(() => {
    if (isValidTabId(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  useEffect(() => {
    if (connectedStatus !== "success" && connectedStatus !== "error") {
      return;
    }

    if (connectedStatus === "success") {
      toast.success("Social account connected successfully.");
      router.refresh();
    } else {
      toast.error("Social account connection failed. Try again.");
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("connected");
    if (!params.get("tab")) {
      params.set("tab", "accounts");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [connectedStatus, pathname, router, searchParams]);

  function handleTabChange(tabId: SettingsTabId) {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.push(`${pathname}?${params.toString()}`);
  }

  const [brand, setBrand] = useState(initialBrand);
  const [editingSection, setEditingSection] = useState<SectionId | null>(null);
  const [, setSavedSection] = useState<SectionId | null>(null);
  const [savingSection, setSavingSection] = useState<SectionId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [disconnectPlatformId, setDisconnectPlatformId] = useState<string | null>(
    null
  );
  const [accountActionPending, setAccountActionPending] = useState(false);

  const drafts = useMemo(() => buildDrafts(brand), [brand]);
  const [companyDetailsDraft, setCompanyDetailsDraft] =
    useState<CompanyDetailsDraft>(drafts.companyDetails);
  const [brandVoiceDraft, setBrandVoiceDraft] =
    useState<BrandVoiceDraft>(drafts.brandVoice);
  const [visualIdentityDraft, setVisualIdentityDraft] =
    useState<VisualIdentityDraft>(drafts.visualIdentity);
  const [contentPreferencesDraft, setContentPreferencesDraft] =
    useState<ContentPreferencesDraft>(drafts.contentPreferences);
  const [notificationEmails, setNotificationEmails] = useState<string[]>(
    buildNotificationEmailsDraft(initialBrand, company.owner_email)
  );
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [visualRefs, setVisualRefs] = useState<string[]>(
    parseVisualReferences(initialBrand.visual_references)
  );
  const [newRef, setNewRef] = useState("");

  const ownerEmail = company.owner_email.trim().toLowerCase();
  const savedNotificationEmails = useMemo(
    () => buildNotificationEmailsDraft(brand, company.owner_email),
    [brand, company.owner_email]
  );

  const topicsToCoverRef = useRef<TagInputHandle>(null);
  const topicsToAvoidRef = useRef<TagInputHandle>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const accountIds = useMemo(
    () => parseZernioAccountIds(brand.zernio_account_ids),
    [brand.zernio_account_ids]
  );
  const preferredTimes = useMemo(
    () => parsePreferredTimes(brand.preferred_times),
    [brand.preferred_times]
  );
  const visualReferences = useMemo(
    () => parseVisualReferences(brand.visual_references),
    [brand.visual_references]
  );

  function startEditing(sectionId: SectionId) {
    const latest = buildDrafts(brand);
    setCompanyDetailsDraft(latest.companyDetails);
    setBrandVoiceDraft(latest.brandVoice);
    setVisualIdentityDraft(latest.visualIdentity);
    setContentPreferencesDraft(latest.contentPreferences);
    setNotificationEmails(
      buildNotificationEmailsDraft(brand, company.owner_email)
    );
    setVisualRefs(parseVisualReferences(brand.visual_references));
    setNewRef("");
    setNewEmail("");
    setEmailError("");
    setEditingSection(sectionId);
    setError(null);
  }

  function cancelEditing(sectionId: SectionId) {
    const latest = buildDrafts(brand);
    if (sectionId === "company-details") {
      setCompanyDetailsDraft(latest.companyDetails);
    }
    if (sectionId === "brand-voice") {
      setBrandVoiceDraft(latest.brandVoice);
    }
    if (sectionId === "visual-identity") {
      setVisualIdentityDraft(latest.visualIdentity);
      setVisualRefs(parseVisualReferences(brand.visual_references));
      setNewRef("");
    }
    if (sectionId === "content-preferences") {
      setContentPreferencesDraft(latest.contentPreferences);
    }
    if (sectionId === "notifications") {
      setNotificationEmails(
        buildNotificationEmailsDraft(brand, company.owner_email)
      );
      setNewEmail("");
      setEmailError("");
    }
    setEditingSection(null);
    setError(null);
  }

  async function patchBrandConfig(body: Record<string, unknown>) {
    const response = await fetch(`/api/dashboard/${company.slug}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      data: BrandConfig | null;
      error: string | null;
    };

    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to save settings.");
    }

    return payload.data;
  }

  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!valid) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (trimmed === ownerEmail || notificationEmails.includes(trimmed)) {
      setEmailError("Already added");
      return;
    }

    setNotificationEmails((prev) => [...prev, trimmed]);
    setNewEmail("");
    setEmailError("");
  };

  const handleRemoveEmail = (email: string) => {
    setNotificationEmails((prev) => prev.filter((item) => item !== email));
  };

  async function handleSave(sectionId: SectionId) {
    if (sectionId === "connected-accounts") {
      return;
    }

    setSavingSection(sectionId);
    setError(null);

    try {
      let updatedBrand: BrandConfig;

      switch (sectionId) {
        case "company-details": {
          const parsed = clientCompanyDetailsSchema.safeParse({
            target_audience: companyDetailsDraft.targetAudience,
            unique_selling_point: companyDetailsDraft.uniqueSellingPoint,
            visual_audience_profile: buildVisualAudienceProfileForSave(
              companyDetailsDraft.visualAudienceDemographic,
              companyDetailsDraft.visualAudienceLocalPct
            ),
          });
          if (!parsed.success) {
            throw new Error(
              parsed.error.issues[0]?.message ?? "Invalid company details."
            );
          }
          updatedBrand = await patchBrandConfig(parsed.data);
          break;
        }
        case "brand-voice": {
          const topicsToCover =
            topicsToCoverRef.current?.flushPendingInput() ??
            brandVoiceDraft.topicsToCover;
          const topicsToAvoid =
            topicsToAvoidRef.current?.flushPendingInput() ??
            brandVoiceDraft.topicsToAvoid;

          const parsed = clientBrandVoiceSchema.safeParse({
            tone: brandVoiceDraft.tone,
            topics_to_cover: topicsToCover,
            topics_to_avoid: topicsToAvoid,
            brand_voice_doc: brandVoiceDraft.brandVoiceDoc.trim() || null,
          });
          if (!parsed.success) {
            throw new Error(parsed.error.issues[0]?.message ?? "Invalid brand voice.");
          }
          updatedBrand = await patchBrandConfig(parsed.data);
          break;
        }
        case "visual-identity": {
          const parsed = clientVisualIdentitySchema.safeParse({
            primary_color: visualIdentityDraft.primaryColor,
            secondary_color: visualIdentityDraft.secondaryColor,
            accent_color: visualIdentityDraft.accentColor,
            image_style: visualIdentityDraft.imageStyle,
            logo_url: visualIdentityDraft.logoUrl,
          });
          if (!parsed.success) {
            throw new Error(
              parsed.error.issues[0]?.message ?? "Invalid visual identity."
            );
          }
          updatedBrand = await patchBrandConfig(parsed.data);

          const refResponse = await fetch(
            `/api/admin/brand-config/${company.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ visual_references: visualRefs }),
            }
          );

          const refPayload = (await refResponse.json()) as {
            data: BrandConfig | null;
            error: string | null;
          };

          if (!refResponse.ok || refPayload.error || !refPayload.data) {
            throw new Error(
              refPayload.error ?? "Failed to save visual references."
            );
          }

          updatedBrand = refPayload.data;
          break;
        }
        case "content-preferences": {
          const parsed = clientContentPreferencesSchema.safeParse({
            post_frequency: contentPreferencesDraft.postFrequency,
            promotional_pct: contentPreferencesDraft.promotionalPct,
            educational_pct: contentPreferencesDraft.educationalPct,
            engagement_pct: contentPreferencesDraft.engagementPct,
            timezone: contentPreferencesDraft.timezone,
          });
          if (!parsed.success) {
            throw new Error(
              parsed.error.issues[0]?.message ?? "Invalid content preferences."
            );
          }
          updatedBrand = await patchBrandConfig(parsed.data);
          break;
        }
        case "notifications": {
          const parsed = clientNotificationsSchema.safeParse({
            notification_emails: notificationEmails,
          });
          if (!parsed.success) {
            throw new Error(
              parsed.error.issues[0]?.message ?? "Invalid notification emails."
            );
          }
          updatedBrand = await patchBrandConfig(parsed.data);
          break;
        }
      }

      setBrand(updatedBrand);
      if (sectionId === "notifications") {
        setNotificationEmails(
          buildNotificationEmailsDraft(updatedBrand, company.owner_email)
        );
      }
      setEditingSection(null);
      setSavedSection(sectionId);
      window.setTimeout(() => {
        setSavedSection((current) => (current === sectionId ? null : current));
      }, 2000);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Failed to save settings.";
      setError(message);
    } finally {
      setSavingSection(null);
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `/api/dashboard/${company.slug}/settings/logo`,
        {
          method: "POST",
          body: formData,
        }
      );

      const payload = (await response.json()) as {
        data: { logo_url: string } | null;
        error: string | null;
      };

      if (!response.ok || !payload.data?.logo_url) {
        throw new Error(payload.error ?? "Failed to upload logo.");
      }

      setVisualIdentityDraft((current) => ({
        ...current,
        logoUrl: payload.data?.logo_url ?? null,
      }));
      setBrand((current) => ({
        ...current,
        logo_url: payload.data?.logo_url ?? current.logo_url,
      }));
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Failed to upload logo.";
      setError(message);
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleContentMixChange(
    key: "promotionalPct" | "educationalPct" | "engagementPct",
    value: number
  ) {
    const next = adjustContentMix(contentPreferencesDraft, key, value);
    setContentPreferencesDraft((current) => ({ ...current, ...next }));
  }

  const postFrequencyLabel = getPostFrequencyLabel(brand.post_frequency);

  const sortedPlatforms = useMemo(
    () =>
      [...ALL_PLATFORMS].sort(
        (left, right) =>
          getPlatformSortRank(left.id, brand.active_platforms, accountIds) -
          getPlatformSortRank(right.id, brand.active_platforms, accountIds)
      ),
    [brand.active_platforms, accountIds]
  );

  const handleConnect = async (platformId: string) => {
    if (!ZERNIO_CONNECT_PLATFORM_IDS.has(platformId)) {
      console.error("[connect] Platform not supported for OAuth:", platformId);
      toast.error("This platform cannot be connected yet.");
      return;
    }

    const meta = ALL_PLATFORMS.find((platform) => platform.id === platformId);
    const platformLabel = meta?.label ?? platformId;

    setAccountActionPending(true);
    try {
      const response = await fetch("/api/admin/zernio/connect-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: company.id,
          companyName: company.name,
          platform: toZernioConnectPlatform(platformId),
        }),
      });

      const payload = (await response.json()) as {
        data: { authUrl: string } | null;
        error: string | null;
      };

      const authUrl = payload.data?.authUrl;
      if (!authUrl) {
        throw new Error(payload.error ?? "Failed to start connection.");
      }

      window.location.href = authUrl;
    } catch (err) {
      console.error("[connect]", err);
      toast.error(
        err instanceof Error ? err.message : `Failed to connect ${platformLabel}.`
      );
      setAccountActionPending(false);
    }
  };

  const handleAddPlatform = async (platformId: string) => {
    const meta = ALL_PLATFORMS.find((platform) => platform.id === platformId);
    if (!meta) {
      return;
    }

    if (!isPlatformActive(platformId, brand.active_platforms)) {
      const updatedPlatforms = [...brand.active_platforms, meta.activeName];

      try {
        const response = await fetch(`/api/admin/brand-config/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active_platforms: updatedPlatforms }),
        });

        const payload = (await response.json()) as {
          data: BrandConfig | null;
          error: string | null;
        };

        if (payload.data) {
          setBrand(payload.data);
        } else {
          setBrand((current) => ({
            ...current,
            active_platforms: updatedPlatforms,
          }));
        }
      } catch (err) {
        console.error("[addPlatform] Failed:", err);
        toast.error(`Failed to add ${meta.label}.`);
        return;
      }
    }

    if (ZERNIO_CONNECT_PLATFORM_IDS.has(platformId)) {
      await handleConnect(platformId);
    }
  };

  const performDisconnect = async (platformId: string) => {
    const meta = ALL_PLATFORMS.find((platform) => platform.id === platformId);
    const platformLabel = meta?.label ?? platformId;

    const key = toAccountIdKey(platformId);
    const current = { ...accountIds };
    delete current[key];
    if (key === "x") {
      delete current.twitter;
    }

    setAccountActionPending(true);
    try {
      const response = await fetch(`/api/admin/brand-config/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zernio_account_ids: current }),
      });

      const payload = (await response.json()) as {
        data: BrandConfig | null;
        error: string | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? `Failed to disconnect ${platformLabel}.`);
      }

      if (payload.data) {
        setBrand(payload.data);
      } else {
        setBrand((currentBrand) => ({
          ...currentBrand,
          zernio_account_ids: current,
        }));
      }

      toast.success(`${platformLabel} disconnected.`);
      router.refresh();
    } catch (err) {
      console.error("[disconnect] Failed:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to disconnect ${platformLabel}.`
      );
    } finally {
      setAccountActionPending(false);
      setDisconnectPlatformId(null);
    }
  };

  const disconnectPlatformLabel =
    ALL_PLATFORMS.find((platform) => platform.id === disconnectPlatformId)
      ?.label ?? disconnectPlatformId ?? "this platform";

  return (
    <div className="-mx-4 min-h-full bg-[#F3F4F6] dark:bg-[#0a0a0a] px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#111111] dark:text-white">Settings</h2>
          <p className="mt-1 text-[#6b7280] dark:text-slate-400">
            Manage your brand configuration and preferences.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-[#E5E7EB] dark:border-[#2a2a2a] pb-2">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-violet-500 text-violet-300"
                  : "border-transparent text-[#9ca3af] dark:text-slate-500 hover:text-[#374151] dark:text-slate-300"
              }`}
            >
              <tab.icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        <div>
            {activeTab === "company" ? (
          <SettingsSectionCard
            title="Company Details"
            sectionId="company-details"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
            editable
          >
            {editingSection === "company-details" ? (
              <div className="flex flex-col gap-4">
                <Field label="Target audience">
                  <Textarea
                    value={companyDetailsDraft.targetAudience}
                    onChange={(event) =>
                      setCompanyDetailsDraft((current) => ({
                        ...current,
                        targetAudience: event.target.value,
                      }))
                    }
                    rows={4}
                    className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                  />
                </Field>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[#374151] dark:text-slate-300">Visual audience profile</Label>
                    <p className="mt-1 text-xs text-[#9ca3af] dark:text-slate-500">
                      Controls what kind of people appear in your AI-generated
                      images.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {VISUAL_AUDIENCE_OPTIONS.map((option) => {
                      const selected =
                        companyDetailsDraft.visualAudienceDemographic ===
                        option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setCompanyDetailsDraft((current) => ({
                              ...current,
                              visualAudienceDemographic: option.value,
                            }))
                          }
                          className={cn(
                            "rounded-lg border p-3 text-left transition-colors",
                            selected
                              ? "border-violet-500 bg-violet-500/10 text-[#CC2B2B] dark:text-white"
                              : "border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#6b7280] dark:text-slate-400 hover:border-violet-500/40"
                          )}
                        >
                          <span className="block text-sm font-medium">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs text-[#9ca3af] dark:text-slate-500">
                            {option.subtext}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {companyDetailsDraft.visualAudienceDemographic === "mixed" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-[#6b7280] dark:text-slate-400">
                        {companyDetailsDraft.visualAudienceLocalPct}% local /{" "}
                        {100 - companyDetailsDraft.visualAudienceLocalPct}%
                        tourist
                      </p>
                      <Slider
                        min={0}
                        max={100}
                        step={10}
                        value={[companyDetailsDraft.visualAudienceLocalPct]}
                        onValueChange={([next]) =>
                          setCompanyDetailsDraft((current) => ({
                            ...current,
                            visualAudienceLocalPct: next,
                          }))
                        }
                      />
                    </div>
                  ) : null}
                </div>
                <Field label="Unique selling point">
                  <Textarea
                    value={companyDetailsDraft.uniqueSellingPoint}
                    onChange={(event) =>
                      setCompanyDetailsDraft((current) => ({
                        ...current,
                        uniqueSellingPoint: event.target.value,
                      }))
                    }
                    rows={4}
                    className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <GridField label="Target audience">
                  <TextValue value={brand.target_audience} />
                </GridField>
                <GridField label="Unique selling point">
                  <TextValue value={brand.unique_selling_point} />
                </GridField>
                <GridField label="Visual audience">
                  {formatVisualAudienceLabel(brand.visual_audience_profile) ? (
                    <VioletTag>
                      {formatVisualAudienceLabel(brand.visual_audience_profile)}
                    </VioletTag>
                  ) : (
                    <EmptyValue />
                  )}
                </GridField>
              </div>
            )}
          </SettingsSectionCard>
            ) : null}

            {activeTab === "brand" ? (
          <SettingsSectionCard
            title="Brand Voice"
            sectionId="brand-voice"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
            editable
          >
            {editingSection === "brand-voice" ? (
              <div className="flex flex-col gap-4">
                <Field label="Tone">
                  <RadioCards
                    options={TONES}
                    value={brandVoiceDraft.tone}
                    onChange={(value) =>
                      setBrandVoiceDraft((current) => ({
                        ...current,
                        tone: value,
                      }))
                    }
                  />
                </Field>
                <Field label="Topics to cover">
                  <TagInput
                    ref={topicsToCoverRef}
                    value={brandVoiceDraft.topicsToCover}
                    onChange={(value) =>
                      setBrandVoiceDraft((current) => ({
                        ...current,
                        topicsToCover: value,
                      }))
                    }
                    placeholder="Add a topic"
                  />
                </Field>
                <Field label="Topics to avoid">
                  <TagInput
                    ref={topicsToAvoidRef}
                    value={brandVoiceDraft.topicsToAvoid}
                    onChange={(value) =>
                      setBrandVoiceDraft((current) => ({
                        ...current,
                        topicsToAvoid: value,
                      }))
                    }
                    placeholder="Add a topic"
                  />
                </Field>
                <Field label="Brand voice document">
                  <Textarea
                    value={brandVoiceDraft.brandVoiceDoc}
                    onChange={(event) =>
                      setBrandVoiceDraft((current) => ({
                        ...current,
                        brandVoiceDoc: event.target.value,
                      }))
                    }
                    rows={6}
                    className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                  />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <GridField label="Tone">
                  {brand.tone ? <VioletTag>{brand.tone}</VioletTag> : <EmptyValue />}
                </GridField>
                <GridField label="Topics to cover">
                  <TagList tags={normalizeStringArray(brand.topics_to_cover)} />
                </GridField>
                <GridField label="Topics to avoid">
                  <TagList tags={normalizeStringArray(brand.topics_to_avoid)} />
                </GridField>
                <GridField label="Brand voice document" className="col-span-3">
                  <ExpandableParagraph value={brand.brand_voice_doc} />
                </GridField>
                <GridField label="Competitor handles" className="col-span-3">
                  {normalizeStringArray(brand.competitor_handles).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {normalizeStringArray(brand.competitor_handles).map(
                        (handle) => (
                          <VioletTag key={handle}>@{handle}</VioletTag>
                        )
                      )}
                    </div>
                  ) : (
                    <EmptyValue />
                  )}
                </GridField>
              </div>
            )}
          </SettingsSectionCard>
            ) : null}

            {activeTab === "visual" ? (
          <SettingsSectionCard
            title="Visual Identity"
            sectionId="visual-identity"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
            editable
          >
            {editingSection === "visual-identity" ? (
              <div className="flex flex-col gap-4">
                <Field label="Logo">
                  <div className="flex items-center gap-4">
                    {visualIdentityDraft.logoUrl ? (
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={visualIdentityDraft.logoUrl}
                          alt="Company logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] dark:border-[#2a2a2a] text-xs text-[#9ca3af] dark:text-slate-500">
                        No logo
                      </div>
                    )}
                    <div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleLogoUpload(file);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="border-[#E5E7EB] dark:border-[#2a2a2a] bg-transparent text-[#374151] dark:text-slate-300 hover:bg-[#FDF2F2] dark:hover:bg-[#f8fafc] dark:bg-[#1f1f1f]"
                      >
                        {uploadingLogo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          "Upload logo"
                        )}
                      </Button>
                    </div>
                  </div>
                </Field>
                <div className="grid gap-4 md:grid-cols-3">
                  <ColorPicker
                    label="Primary color"
                    value={visualIdentityDraft.primaryColor}
                    onChange={(value) =>
                      setVisualIdentityDraft((current) => ({
                        ...current,
                        primaryColor: value,
                      }))
                    }
                  />
                  <ColorPicker
                    label="Secondary color"
                    value={visualIdentityDraft.secondaryColor}
                    onChange={(value) =>
                      setVisualIdentityDraft((current) => ({
                        ...current,
                        secondaryColor: value,
                      }))
                    }
                  />
                  <ColorPicker
                    label="Accent color"
                    value={visualIdentityDraft.accentColor}
                    onChange={(value) =>
                      setVisualIdentityDraft((current) => ({
                        ...current,
                        accentColor: value,
                      }))
                    }
                  />
                </div>
                <Field label="Image style">
                  <RadioCards
                    options={IMAGE_STYLES}
                    labels={IMAGE_STYLE_LABELS}
                    value={visualIdentityDraft.imageStyle}
                    onChange={(value) =>
                      setVisualIdentityDraft((current) => ({
                        ...current,
                        imageStyle: value,
                      }))
                    }
                  />
                </Field>
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                    Visual references
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {visualRefs.map((ref, index) => (
                      <span
                        key={`${ref}-${index}`}
                        className={SETTINGS_BADGE.tagEditable}
                      >
                        {ref}
                        <button
                          type="button"
                          onClick={() =>
                            setVisualRefs((previous) =>
                              previous.filter(
                                (_, itemIndex) => itemIndex !== index
                              )
                            )
                          }
                        >
                          <X
                            size={10}
                            className="text-[#9ca3af] dark:text-slate-500 hover:text-rose-400"
                          />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRef}
                      onChange={(event) => setNewRef(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && newRef.trim()) {
                          event.preventDefault();
                          setVisualRefs((previous) => [
                            ...previous,
                            newRef.trim(),
                          ]);
                          setNewRef("");
                        }
                      }}
                      placeholder="e.g. warm golden hour lighting, overhead flat-lay food photography"
                      className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-3 py-2 text-sm text-[#374151] dark:text-slate-300 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newRef.trim()) {
                          setVisualRefs((previous) => [
                            ...previous,
                            newRef.trim(),
                          ]);
                          setNewRef("");
                        }
                      }}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-xs text-[#111111] dark:text-white transition-colors hover:bg-violet-500"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                <GridField label="Logo">
                  {brand.logo_url ? (
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={brand.logo_url}
                        alt="Company logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <EmptyValue />
                  )}
                </GridField>
                <ColorReadOnly label="Primary color" value={brand.primary_color} />
                <ColorReadOnly label="Secondary color" value={brand.secondary_color} />
                <ColorReadOnly label="Accent color" value={brand.accent_color} />
                <GridField label="Image style">
                  <p className="text-sm text-[#374151] dark:text-slate-300">
                    {IMAGE_STYLE_LABELS[
                      brand.image_style as (typeof IMAGE_STYLES)[number]
                    ] ?? brand.image_style}
                  </p>
                </GridField>
                <GridField label="Visual references" className="col-span-3">
                  {visualReferences.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {visualReferences.map((ref, index) => (
                        <span
                          key={`${ref}-${index}`}
                          className={SETTINGS_BADGE.tagEditable}
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-slate-600">Not set</p>
                  )}
                </GridField>
              </div>
            )}
          </SettingsSectionCard>
            ) : null}

            {activeTab === "content" ? (
          <SettingsSectionCard
            title="Content Preferences"
            sectionId="content-preferences"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
            editable
          >
            {editingSection === "content-preferences" ? (
              <div className="flex flex-col gap-4">
                <Field label="Post frequency">
                  <Select
                    value={String(contentPreferencesDraft.postFrequency)}
                    onValueChange={(value) =>
                      setContentPreferencesDraft((current) => ({
                        ...current,
                        postFrequency: Number(value),
                      }))
                    }
                  >
                    <SelectTrigger className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid gap-6 md:grid-cols-3">
                  {(
                    [
                      ["promotionalPct", "Promotional", contentPreferencesDraft.promotionalPct],
                      ["educationalPct", "Educational", contentPreferencesDraft.educationalPct],
                      ["engagementPct", "Engagement", contentPreferencesDraft.engagementPct],
                    ] as const
                  ).map(([key, label, value]) => (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[#374151] dark:text-slate-300">{label}</Label>
                        <span className="text-sm font-medium text-violet-400">
                          {value}%
                        </span>
                      </div>
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[value]}
                        onValueChange={([next]) =>
                          handleContentMixChange(key, next)
                        }
                      />
                    </div>
                  ))}
                </div>
                <Field label="Timezone">
                  <Select
                    value={contentPreferencesDraft.timezone}
                    onValueChange={(value) =>
                      setContentPreferencesDraft((current) => ({
                        ...current,
                        timezone: value,
                      }))
                    }
                  >
                    <SelectTrigger className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white">
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
                </Field>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                    Content mix
                  </p>
                  <div className="flex flex-col gap-2">
                    {[
                      {
                        label: "Educational",
                        value: brand.educational_pct ?? 0,
                        color: "bg-violet-500",
                      },
                      {
                        label: "Promotional",
                        value: brand.promotional_pct ?? 0,
                        color: "bg-cyan-500",
                      },
                      {
                        label: "Engagement",
                        value: brand.engagement_pct ?? 0,
                        color: "bg-emerald-500",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="w-24 flex-shrink-0 text-xs text-[#6b7280] dark:text-slate-400">
                          {label}
                        </span>
                        <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-[#1f1f1f]">
                          <div
                            className={`h-2 rounded-full ${color} transition-all`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-[#374151] dark:text-slate-300">
                          {value}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                      Post frequency
                    </p>
                    <p className="text-sm text-[#374151] dark:text-slate-300">{postFrequencyLabel}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                      Timezone
                    </p>
                    <p className="text-sm text-[#374151] dark:text-slate-300">
                      {brand.timezone ?? "Not set"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                      Preferred times
                    </p>
                    {brand.active_platforms.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {brand.active_platforms.map((platform) => (
                          <span
                            key={platform}
                            className={`${SETTINGS_BADGE.tagEditable} capitalize`}
                          >
                            {platform}: {preferredTimes[platform] ?? "Not set"}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-slate-600">Not set</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SettingsSectionCard>
            ) : null}

            {activeTab === "products" ? (
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
                <span className="mb-5 block text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                  Product Library
                </span>
                <ProductPhotoLibrary companySlug={company.slug} />
              </div>
            ) : null}

            {activeTab === "accounts" ? (
          <SettingsSectionCard
            title="Connected Accounts"
            sectionId="connected-accounts"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
          >
            <div className="space-y-0">
              {sortedPlatforms.map((platform) => {
                const active = isPlatformActive(
                  platform.id,
                  brand.active_platforms
                );
                const connected = isPlatformConnected(platform.id, accountIds);

                if (active && connected) {
                  return (
                    <div
                      key={platform.id}
                      className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-3 last:border-0"
                    >
                      <span className={SETTINGS_BADGE.platform}>
                        {platform.label}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className={SETTINGS_BADGE.connected}>
                          Connected
                        </span>
                        <button
                          type="button"
                          onClick={() => setDisconnectPlatformId(platform.id)}
                          disabled={accountActionPending}
                          className="text-xs text-slate-600 transition-colors hover:text-rose-400 disabled:opacity-50"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  );
                }

                if (active) {
                  return (
                    <div
                      key={platform.id}
                      className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-3 last:border-0"
                    >
                      <span className={SETTINGS_BADGE.platform}>
                        {platform.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleConnect(platform.id)}
                        disabled={accountActionPending}
                        className={SETTINGS_BADGE.connect}
                      >
                        <Plus size={11} />
                        Connect
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={platform.id}
                    className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#2a2a2a] py-3 opacity-50 last:border-0"
                  >
                    <span className={SETTINGS_BADGE.notConnected}>
                      {platform.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleAddPlatform(platform.id)}
                      disabled={accountActionPending}
                      className={`${SETTINGS_BADGE.addPlatform} flex items-center gap-1.5`}
                    >
                      <Plus size={11} />
                      Add platform
                    </button>
                  </div>
                );
              })}
            </div>
          </SettingsSectionCard>
            ) : null}

            <AlertDialog
              open={Boolean(disconnectPlatformId)}
              onOpenChange={(open) => {
                if (!open && !accountActionPending) {
                  setDisconnectPlatformId(null);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Disconnect {disconnectPlatformLabel}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Posts to this platform will stop until reconnected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={accountActionPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[#CC2B2B] text-white hover:bg-[#B02424]"
                    disabled={accountActionPending || !disconnectPlatformId}
                    onClick={(event) => {
                      event.preventDefault();
                      if (disconnectPlatformId) {
                        void performDisconnect(disconnectPlatformId);
                      }
                    }}
                  >
                    {accountActionPending ? "Disconnecting…" : "Disconnect"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {activeTab === "holidays" ? (
              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
                <div className="mb-5">
                  <span className="block text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
                    Holidays &amp; occasions
                  </span>
                  <p className="mt-1 text-xs text-slate-600">
                    The AI uses these to create timely, culturally relevant content.
                    Toggle off any occasions you do not want featured in your posts.
                  </p>
                </div>
                <HolidayCalendar
                  companySlug={company.slug}
                  initialHolidays={initialHolidays}
                />
              </div>
            ) : null}

            {activeTab === "notifications" ? (
          <SettingsSectionCard
            title="Notifications"
            sectionId="notifications"
            editingSection={editingSection}
            savingSection={savingSection}
            onEdit={startEditing}
            onCancel={cancelEditing}
            onSave={handleSave}
            editable
          >
            {editingSection === "notifications" ? (
              <div className="flex flex-col gap-4">
                <Field label="Email recipients">
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={SETTINGS_BADGE.ownerEmail}
                      title="Owner email -- cannot be removed"
                    >
                      <Lock className="h-3 w-3 shrink-0" />
                      {ownerEmail}
                    </span>
                    {notificationEmails.map((email) => (
                      <span
                        key={email}
                        className={`${SETTINGS_BADGE.tag} inline-flex items-center gap-1.5`}
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="text-[#9ca3af] dark:text-slate-500 hover:text-[#111111] dark:text-white"
                          aria-label={`Remove ${email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </Field>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <Input
                    value={newEmail}
                    onChange={(event) => {
                      setNewEmail(event.target.value);
                      if (emailError) {
                        setEmailError("");
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddEmail();
                      }
                    }}
                    placeholder="Add email address"
                    className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#111111] dark:text-white"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddEmail}
                    className="border-[#E5E7EB] dark:border-[#2a2a2a] bg-transparent text-[#374151] dark:text-slate-300 hover:bg-[#FDF2F2] dark:hover:bg-[#f8fafc] dark:bg-[#1f1f1f]"
                  >
                    Add
                  </Button>
                </div>
                {emailError ? (
                  <p className="text-sm text-rose-400">{emailError}</p>
                ) : null}
              </div>
            ) : (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                  Email recipients
                </p>
                <div className="flex flex-wrap gap-2">
                  <VioletTag>{ownerEmail}</VioletTag>
                  {savedNotificationEmails.length > 0 ? (
                    savedNotificationEmails.map((email) => (
                      <span
                        key={email}
                        className={SETTINGS_BADGE.tag}
                      >
                        {email}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm italic text-slate-600">
                      No additional recipients configured.
                    </span>
                  )}
                </div>
              </div>
            )}
          </SettingsSectionCard>
            ) : null}
        </div>
      </div>
    </div>
  );
}

function SettingsSectionCard({
  title,
  sectionId,
  editingSection,
  savingSection,
  editable,
  onEdit,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  sectionId: SectionId;
  editingSection: SectionId | null;
  savingSection: SectionId | null;
  editable?: boolean;
  onEdit: (sectionId: SectionId) => void;
  onCancel: (sectionId: SectionId) => void;
  onSave: (sectionId: SectionId) => void;
  children: React.ReactNode;
}) {
  const isEditing = editingSection === sectionId;
  const isSaving = savingSection === sectionId;

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] p-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
          {title}
        </span>
        {editable ? (
          !isEditing ? (
            <button
              type="button"
              onClick={() => onEdit(sectionId)}
              className="flex items-center gap-1.5 text-xs text-[#9ca3af] dark:text-slate-500 transition-colors hover:text-violet-400"
            >
              <Pencil size={12} aria-hidden="true" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void onSave(sectionId)}
                disabled={isSaving}
                className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => onCancel(sectionId)}
                disabled={isSaving}
                className="text-xs text-[#9ca3af] dark:text-slate-500 hover:text-[#374151] dark:text-slate-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )
        ) : null}
      </div>
      {children}
    </div>
  );
}

function EmptyValue() {
  return <span className="text-sm italic text-slate-600">Not set</span>;
}

const SETTINGS_BADGE = {
  platform:
    "rounded-full border px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#1f1f1f] dark:text-slate-300 dark:border-[#2e2e5a]",
  violet:
    "rounded-full border px-3 py-1.5 text-xs bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
  violetSm:
    "rounded-full border px-2 py-0.5 text-xs bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
  connected:
    "rounded-full border px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800",
  notConnected:
    "rounded-full border px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  addPlatform:
    "rounded-full border px-3 py-1.5 text-xs bg-white text-[#CC2B2B] border-[#bfdbfe] transition-colors hover:bg-[#eff6ff] dark:bg-[#161616] dark:text-violet-400 dark:border-violet-800 dark:hover:bg-[#1f1f1f]",
  connect:
    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs bg-violet-100 text-violet-700 border-violet-200 transition-colors hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700 dark:hover:bg-violet-900/50",
  tag:
    "rounded-full border px-3 py-1 text-xs bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#0a0a0a] dark:text-slate-300 dark:border-[#2a2a2a]",
  tagEditable:
    "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#1f1f1f] dark:text-slate-300 dark:border-[#2e2e5a]",
  ownerEmail:
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800/60",
} as const;

function VioletTag({ children }: { children: React.ReactNode }) {
  return <span className={SETTINGS_BADGE.violetSm}>{children}</span>;
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <EmptyValue />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <VioletTag key={tag}>{tag}</VioletTag>
      ))}
    </div>
  );
}

function GridField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function TextValue({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) {
    return <EmptyValue />;
  }

  return <p className="text-sm text-[#374151] dark:text-slate-300">{value}</p>;
}

function ExpandableParagraph({ value }: { value: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);

  if (!value?.trim()) {
    return <EmptyValue />;
  }

  const shouldTruncate = value.trim().length > 280;

  return (
    <div>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm text-[#374151] dark:text-slate-300",
          !expanded && shouldTruncate && "line-clamp-4"
        )}
      >
        {value}
      </p>
      {shouldTruncate ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs text-violet-400 hover:text-violet-300"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[#374151] dark:text-slate-300">{label}</Label>
      {children}
    </div>
  );
}

function ColorReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <GridField label={label}>
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-[#E5E7EB] dark:border-[#2a2a2a]"
          style={{ backgroundColor: value }}
        />
        <span className="font-mono text-sm text-[#374151] dark:text-slate-300">{value}</span>
      </div>
    </GridField>
  );
}
function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[#374151] dark:text-slate-300">{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a]"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] font-mono uppercase text-[#111111] dark:text-white"
        />
      </div>
    </div>
  );
}

function RadioCards<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels?: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => {
        const selected = value === option;
        const label = labels?.[option] ?? option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "rounded-lg border p-3 text-left text-sm transition-colors",
              selected
                ? "border-violet-500 bg-violet-500/10 text-[#CC2B2B] dark:text-white"
                : "border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] text-[#6b7280] dark:text-slate-400 hover:border-violet-500/40"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
