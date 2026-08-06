"use client";

import {
  ImageIcon,
  Loader2,
  Pencil,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { DragEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { TagInput } from "@/components/onboarding/TagInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { BrandConfig, Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import {
  adjustContentMix,
  IMAGE_STYLES,
  INDUSTRY_SUGGESTIONS,
  PLATFORMS,
  TIMEZONES,
  TONES,
} from "@/lib/validations/onboard";
import {
  brandConfigPatchSchema,
  type BrandConfigPatchInput,
} from "@/lib/validations/brand-config-admin";
import {
  normalizeImageStyle,
  normalizeIndustries,
  normalizePlatforms,
  normalizeStringArray,
  normalizeTone,
} from "@/lib/validations/brand-config-normalize";
import { FREQUENCY_OPTIONS, getPostFrequencyLabel } from "@/lib/validations/post-frequency";
import {
  buildVisualAudienceProfileForSave,
  parseVisualAudienceProfile,
  type VisualAudienceDemographic,
} from "@/lib/validations/visual-audience";
import { resolveAccountIdForPlatform } from "@/lib/zernio/account-ids";
import { ProductPhotoLibrary } from "@/components/dashboard/ProductPhotoLibrary";
import { HolidayCalendar } from "@/components/dashboard/HolidayCalendar";

type BrandConfigPanelProps = {
  companyId: string;
  companySlug: string;
  ownerEmail: string;
  initialBrand: BrandConfig;
};

type SectionKey =
  | "identity"
  | "voice"
  | "visual"
  | "platforms"
  | "contentMix";

type IdentityDraft = Pick<
  BrandConfig,
  "industry" | "target_audience" | "unique_selling_point"
>;

type VoiceDraft = Pick<
  BrandConfig,
  | "tone"
  | "brand_voice_doc"
  | "topics_to_cover"
  | "topics_to_avoid"
  | "competitor_handles"
>;

type VisualDraft = Pick<
  BrandConfig,
  | "logo_url"
  | "primary_color"
  | "secondary_color"
  | "accent_color"
  | "image_style"
  | "visual_references"
>;

type PlatformsDraft = Pick<
  BrandConfig,
  | "active_platforms"
  | "post_frequency"
  | "preferred_times"
  | "timezone"
>;

type ContentMixDraft = Pick<
  BrandConfig,
  "promotional_pct" | "educational_pct" | "engagement_pct" | "ga_property_id"
>;

const ACCEPTED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

function parseRecord(value: Json): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function parseVisualReferenceUrls(value: Json): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return Object.values(parseRecord(value)).filter((item) => item.length > 0);
}

function getNotificationRecipientTags(
  brand: BrandConfig,
  ownerEmail: string
): string[] {
  const owner = ownerEmail.trim().toLowerCase();
  const additional = (brand.notification_emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email && email !== owner);

  return [owner, ...additional];
}

function normalizeBrandConfig(config: BrandConfig): BrandConfig {
  return {
    ...config,
    industry: normalizeIndustries(config.industry),
    tone: normalizeTone(config.tone),
    image_style: normalizeImageStyle(config.image_style),
    topics_to_cover: normalizeStringArray(config.topics_to_cover),
    topics_to_avoid: normalizeStringArray(config.topics_to_avoid),
    competitor_handles: normalizeStringArray(config.competitor_handles),
    active_platforms: normalizePlatforms(config.active_platforms),
  };
}

function getToneBadgeClass(): string {
  return "border border-violet-800 bg-violet-900/40 text-violet-400 hover:bg-violet-900/40";
}

function EmptyValue() {
  return <span className="text-sm italic text-slate-600">Not set</span>;
}

function VioletTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-violet-800 bg-violet-900/40 px-2 py-0.5 text-xs text-violet-400">
      {children}
    </span>
  );
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

function ParagraphValue({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) {
    return <EmptyValue />;
  }

  return <p className="whitespace-pre-wrap text-sm text-slate-100">{value}</p>;
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
          "whitespace-pre-wrap text-sm text-slate-100",
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

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        connected
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-amber-500/15 text-amber-400"
      )}
    >
      {connected ? "Connected" : "Not connected"}
    </span>
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
    <div className="space-y-1.5">
      <p className="text-sm text-[#6b7280] dark:text-slate-400">{label}</p>
      <div className="text-sm text-slate-100">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  editing,
  saving,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  editing: boolean;
  saving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
          {title}
        </CardTitle>
        {!editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {editing ? (
          <div className="flex justify-end gap-2 border-t border-[#E5E7EB] dark:border-[#2a2a2a] pt-4">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-tbc-red hover:bg-tbc-red-hover"
              onClick={onSave}
              disabled={saving}
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
        ) : null}
      </CardContent>
    </Card>
  );
}

function ColorSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-8 w-8 shrink-0 rounded-full border border-[#E5E7EB] dark:border-[#2a2a2a]"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-xs text-[#6b7280] dark:text-slate-400">{label}</p>
        <p className="font-mono text-sm text-slate-100">{color}</p>
      </div>
    </div>
  );
}

function ColorEditor({
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
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <Input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-14 cursor-pointer p-1"
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
        />
      </div>
    </div>
  );
}

export function BrandConfigPanel({
  companyId,
  companySlug,
  ownerEmail,
  initialBrand,
}: BrandConfigPanelProps) {
  const [brand, setBrand] = useState<BrandConfig>(
    normalizeBrandConfig(initialBrand)
  );
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [extractingColors, setExtractingColors] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [identityDraft, setIdentityDraft] = useState<IdentityDraft>({
    industry: brand.industry,
    target_audience: brand.target_audience,
    unique_selling_point: brand.unique_selling_point,
  });
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft>({
    tone: brand.tone,
    brand_voice_doc: brand.brand_voice_doc,
    topics_to_cover: brand.topics_to_cover ?? [],
    topics_to_avoid: brand.topics_to_avoid ?? [],
    competitor_handles: brand.competitor_handles ?? [],
  });
  const [visualDraft, setVisualDraft] = useState<VisualDraft>({
    logo_url: brand.logo_url,
    primary_color: brand.primary_color,
    secondary_color: brand.secondary_color,
    accent_color: brand.accent_color,
    image_style: brand.image_style,
    visual_references: brand.visual_references,
  });
  const [platformsDraft, setPlatformsDraft] = useState<PlatformsDraft>({
    active_platforms: brand.active_platforms ?? [],
    post_frequency: brand.post_frequency,
    preferred_times: brand.preferred_times,
    timezone: brand.timezone,
  });
  const [contentMixDraft, setContentMixDraft] = useState<ContentMixDraft>({
    promotional_pct: brand.promotional_pct,
    educational_pct: brand.educational_pct,
    engagement_pct: brand.engagement_pct,
    ga_property_id: brand.ga_property_id,
  });
  const [visualRefs, setVisualRefs] = useState<string[]>(
    parseVisualReferenceUrls(brand.visual_references)
  );
  const [newRef, setNewRef] = useState("");
  const initialVisualAudience = parseVisualAudienceProfile(
    brand.visual_audience_profile
  );
  const [demographic, setDemographic] = useState<VisualAudienceDemographic>(
    initialVisualAudience.demographic
  );
  const [localPct, setLocalPct] = useState(initialVisualAudience.local_pct);

  const preferredTimes = useMemo(
    () => parseRecord(brand.preferred_times),
    [brand.preferred_times]
  );
  const zernioAccountIds = useMemo(
    () => parseRecord(brand.zernio_account_ids),
    [brand.zernio_account_ids]
  );
  const visualReferenceUrls = useMemo(
    () => parseVisualReferenceUrls(brand.visual_references),
    [brand.visual_references]
  );

  function startEditing(section: SectionKey) {
    setEditingSection(section);

    if (section === "identity") {
      setIdentityDraft({
        industry: brand.industry,
        target_audience: brand.target_audience,
        unique_selling_point: brand.unique_selling_point,
      });
      const profile = parseVisualAudienceProfile(brand.visual_audience_profile);
      setDemographic(profile.demographic);
      setLocalPct(profile.local_pct);
    }

    if (section === "voice") {
      setVoiceDraft({
        tone: brand.tone,
        brand_voice_doc: brand.brand_voice_doc,
        topics_to_cover: brand.topics_to_cover ?? [],
        topics_to_avoid: brand.topics_to_avoid ?? [],
        competitor_handles: brand.competitor_handles ?? [],
      });
    }

    if (section === "visual") {
      setVisualDraft({
        logo_url: brand.logo_url,
        primary_color: brand.primary_color,
        secondary_color: brand.secondary_color,
        accent_color: brand.accent_color,
        image_style: brand.image_style,
        visual_references: brand.visual_references,
      });
      setVisualRefs(parseVisualReferenceUrls(brand.visual_references));
      setNewRef("");
    }

    if (section === "platforms") {
      setPlatformsDraft({
        active_platforms: brand.active_platforms ?? [],
        post_frequency: brand.post_frequency,
        preferred_times: brand.preferred_times,
        timezone: brand.timezone,
      });
    }

    if (section === "contentMix") {
      setContentMixDraft({
        promotional_pct: brand.promotional_pct,
        educational_pct: brand.educational_pct,
        engagement_pct: brand.engagement_pct,
        ga_property_id: brand.ga_property_id,
      });
    }
  }

  function cancelEditing() {
    setEditingSection(null);
  }

  async function saveSection(payload: BrandConfigPatchInput) {
    const parsed = brandConfigPatchSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form data.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/admin/brand-config/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const result = (await response.json()) as {
        data: BrandConfig | null;
        error: string | null;
      };

      if (!response.ok || result.error || !result.data) {
        toast.error(result.error ?? "Failed to save changes.");
        return;
      }

      setBrand(normalizeBrandConfig(result.data));
      setEditingSection(null);
      toast.success("Saved");
    } catch {
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, WEBP, or SVG file.");
      return;
    }

    setUploadingLogo(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", companySlug);

      const response = await fetch(
        `/api/admin/brand-config/${companyId}/logo`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = (await response.json()) as {
        data: { logo_url: string } | null;
        error: string | null;
      };

      if (!response.ok || result.error || !result.data?.logo_url) {
        throw new Error(result.error ?? "Failed to upload logo.");
      }

      const logoUrl = result.data.logo_url;

      setVisualDraft((current) => ({
        ...current,
        logo_url: logoUrl,
      }));
      setBrand((current) => ({
        ...current,
        logo_url: logoUrl,
      }));
      toast.success("Logo uploaded.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload logo.";
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function extractColorsFromLogo() {
    if (!visualDraft.logo_url) {
      return;
    }

    setExtractingColors(true);

    try {
      const response = await fetch("/api/admin/extract-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: visualDraft.logo_url }),
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

      setVisualDraft((current) => ({
        ...current,
        primary_color: colors.primary_color,
        secondary_color: colors.secondary_color,
        accent_color: colors.accent_color,
      }));
      toast.success("Colors extracted. Review and save when ready.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract colors.";
      toast.error(message);
    } finally {
      setExtractingColors(false);
    }
  }

  function handleLogoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void uploadLogo(file);
    }
  }

  function togglePlatform(platform: (typeof PLATFORMS)[number]) {
    setPlatformsDraft((current) => {
      const activePlatforms = current.active_platforms ?? [];
      const isActive = activePlatforms.includes(platform);
      const nextActivePlatforms = isActive
        ? activePlatforms.filter((item) => item !== platform)
        : [...activePlatforms, platform];

      const preferredTimesRecord = parseRecord(current.preferred_times);
      if (!isActive) {
        preferredTimesRecord[platform] = preferredTimesRecord[platform] ?? "09:00";
      } else {
        delete preferredTimesRecord[platform];
      }

      return {
        ...current,
        active_platforms: nextActivePlatforms,
        preferred_times: preferredTimesRecord,
      };
    });
  }

  function updatePreferredTime(platform: string, time: string) {
    setPlatformsDraft((current) => ({
      ...current,
      preferred_times: {
        ...parseRecord(current.preferred_times),
        [platform]: time,
      },
    }));
  }

  function updateContentMix(
    key: "promotional_pct" | "educational_pct" | "engagement_pct",
    value: number
  ) {
    setContentMixDraft((current) => {
      const mappedKey =
        key === "promotional_pct"
          ? "promotionalPct"
          : key === "educational_pct"
            ? "educationalPct"
            : "engagementPct";

      const next = adjustContentMix(
        {
          promotionalPct: current.promotional_pct,
          educationalPct: current.educational_pct,
          engagementPct: current.engagement_pct,
        },
        mappedKey,
        value
      );

      return {
        ...current,
        promotional_pct: next.promotionalPct,
        educational_pct: next.educationalPct,
        engagement_pct: next.engagementPct,
      };
    });
  }

  const draftPreferredTimes = parseRecord(platformsDraft.preferred_times);
  const postFrequencyLabel = getPostFrequencyLabel(brand.post_frequency);
  const visualAudienceProfile = parseVisualAudienceProfile(
    brand.visual_audience_profile
  );

  return (
    <div className="space-y-6 rounded-xl bg-[#f8fafc] dark:bg-[#0a0a0a] p-1">
      <SectionCard
        title="Company Identity"
        editing={editingSection === "identity"}
        saving={saving}
        onEdit={() => startEditing("identity")}
        onCancel={cancelEditing}
        onSave={() =>
          saveSection({
            industry: normalizeIndustries(identityDraft.industry),
            target_audience: identityDraft.target_audience.trim(),
            unique_selling_point: identityDraft.unique_selling_point.trim(),
            visual_audience_profile: buildVisualAudienceProfileForSave(
              demographic,
              localPct
            ),
          })
        }
      >
        {editingSection === "identity" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Industry</Label>
              <TagInput
                value={identityDraft.industry}
                onChange={(value) =>
                  setIdentityDraft((current) => ({
                    ...current,
                    industry: value,
                  }))
                }
                placeholder="e.g. Construction, Home Improvement, Retail"
                suggestions={INDUSTRY_SUGGESTIONS}
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Textarea
                value={identityDraft.target_audience}
                onChange={(event) =>
                  setIdentityDraft((current) => ({
                    ...current,
                    target_audience: event.target.value,
                  }))
                }
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Unique Selling Point</Label>
              <Textarea
                value={identityDraft.unique_selling_point}
                onChange={(event) =>
                  setIdentityDraft((current) => ({
                    ...current,
                    unique_selling_point: event.target.value,
                  }))
                }
                rows={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-[#6b7280] dark:text-slate-400">
                Visual audience
              </label>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {(["local", "tourist", "mixed"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setDemographic(option)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                        demographic === option
                          ? "border-violet-500 bg-[#CC2B2B] text-white dark:bg-violet-600"
                          : "border-[#2e2e5a] bg-[#f8fafc] dark:bg-[#1f1f1f] text-[#6b7280] dark:text-slate-400 hover:border-violet-500/40"
                      )}
                    >
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </button>
                  ))}
                </div>
                {demographic === "mixed" ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[#9ca3af] dark:text-slate-500">
                      {localPct}% local / {100 - localPct}% tourist
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={10}
                      value={localPct}
                      onChange={(event) =>
                        setLocalPct(Number(event.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Industry">
              <TagList tags={brand.industry} />
            </Field>
            <Field label="Target Audience">
              <ParagraphValue value={brand.target_audience} />
            </Field>
            <Field label="Unique Selling Point">
              <ParagraphValue value={brand.unique_selling_point} />
            </Field>
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-[#6b7280] dark:text-slate-400">
                Visual audience
              </label>
              <span className="w-fit rounded-full border border-violet-800 bg-violet-900/40 px-2 py-0.5 text-xs text-violet-300">
                {visualAudienceProfile.demographic === "mixed"
                  ? `Mixed (${visualAudienceProfile.local_pct}% local)`
                  : visualAudienceProfile.demographic === "tourist"
                    ? "Tourist"
                    : visualAudienceProfile.demographic === "local"
                      ? "Local"
                      : "Not set"}
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Email recipients">
            <div className="flex flex-wrap gap-2">
              {getNotificationRecipientTags(brand, ownerEmail).map((email) => (
                <VioletTag key={email}>{email}</VioletTag>
              ))}
            </div>
          </Field>
        </CardContent>
      </Card>

      <SectionCard
        title="Brand Voice"
        editing={editingSection === "voice"}
        saving={saving}
        onEdit={() => startEditing("voice")}
        onCancel={cancelEditing}
        onSave={() =>
          saveSection({
            tone: normalizeTone(voiceDraft.tone),
            brand_voice_doc: voiceDraft.brand_voice_doc,
            topics_to_cover: voiceDraft.topics_to_cover,
            topics_to_avoid: voiceDraft.topics_to_avoid,
            competitor_handles: voiceDraft.competitor_handles,
          })
        }
      >
        {editingSection === "voice" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select
                value={voiceDraft.tone}
                onValueChange={(value) =>
                  setVoiceDraft((current) => ({ ...current, tone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Brand Voice Document</Label>
              <Textarea
                value={voiceDraft.brand_voice_doc ?? ""}
                onChange={(event) =>
                  setVoiceDraft((current) => ({
                    ...current,
                    brand_voice_doc: event.target.value,
                  }))
                }
                rows={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Topics to Cover</Label>
              <TagInput
                value={voiceDraft.topics_to_cover}
                onChange={(value) =>
                  setVoiceDraft((current) => ({
                    ...current,
                    topics_to_cover: value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Topics to Avoid</Label>
              <TagInput
                value={voiceDraft.topics_to_avoid}
                onChange={(value) =>
                  setVoiceDraft((current) => ({
                    ...current,
                    topics_to_avoid: value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Competitor Handles</Label>
              <TagInput
                value={voiceDraft.competitor_handles}
                onChange={(value) =>
                  setVoiceDraft((current) => ({
                    ...current,
                    competitor_handles: value,
                  }))
                }
                prefix="@"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Tone">
              {brand.tone ? (
                <Badge className={getToneBadgeClass()}>{brand.tone}</Badge>
              ) : (
                <EmptyValue />
              )}
            </Field>
            <Field label="Brand Voice Document">
              <ExpandableParagraph value={brand.brand_voice_doc} />
            </Field>
            <Field label="Topics to Cover">
              <TagList tags={brand.topics_to_cover} />
            </Field>
            <Field label="Topics to Avoid">
              <TagList tags={brand.topics_to_avoid} />
            </Field>
            <Field label="Competitor Handles">
              {brand.competitor_handles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {brand.competitor_handles.map((handle) => (
                    <VioletTag key={handle}>@{handle}</VioletTag>
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Visual Identity"
        editing={editingSection === "visual"}
        saving={saving}
        onEdit={() => startEditing("visual")}
        onCancel={cancelEditing}
        onSave={() =>
          saveSection({
            logo_url: visualDraft.logo_url,
            primary_color: visualDraft.primary_color,
            secondary_color: visualDraft.secondary_color,
            accent_color: visualDraft.accent_color,
            image_style: normalizeImageStyle(visualDraft.image_style),
            visual_references: visualRefs,
          })
        }
      >
        {editingSection === "visual" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleLogoDrop}
                onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-slate-50 p-6"
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={ACCEPTED_LOGO_TYPES.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadLogo(file);
                    }
                  }}
                />
                {uploadingLogo ? (
                  <Loader2 className="h-8 w-8 animate-spin text-tbc-red" />
                ) : visualDraft.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={visualDraft.logo_url}
                    alt="Logo preview"
                    className="max-h-20 max-w-full object-contain"
                  />
                ) : (
                  <>
                    <Upload className="mb-2 h-6 w-6 text-text-muted" />
                    <p className="text-sm text-text-muted">
                      Drag and drop or click to upload logo
                    </p>
                  </>
                )}
              </div>
              <span
                title={!visualDraft.logo_url ? "Upload a logo first" : undefined}
                className="inline-block"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="border-tbc-red text-tbc-red hover:bg-tbc-red/5 hover:text-tbc-red"
                  disabled={!visualDraft.logo_url || extractingColors || uploadingLogo}
                  onClick={() => void extractColorsFromLogo()}
                >
                  {extractingColors ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analyze Logo with AI
                    </>
                  )}
                </Button>
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <ColorEditor
                label="Primary Color"
                value={visualDraft.primary_color}
                onChange={(value) =>
                  setVisualDraft((current) => ({
                    ...current,
                    primary_color: value,
                  }))
                }
              />
              <ColorEditor
                label="Secondary Color"
                value={visualDraft.secondary_color}
                onChange={(value) =>
                  setVisualDraft((current) => ({
                    ...current,
                    secondary_color: value,
                  }))
                }
              />
              <ColorEditor
                label="Accent Color"
                value={visualDraft.accent_color}
                onChange={(value) =>
                  setVisualDraft((current) => ({
                    ...current,
                    accent_color: value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Image Style</Label>
              <Select
                value={visualDraft.image_style}
                onValueChange={(value) =>
                  setVisualDraft((current) => ({
                    ...current,
                    image_style: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select image style" />
                </SelectTrigger>
                <SelectContent>
                  {IMAGE_STYLES.map((style) => (
                    <SelectItem key={style} value={style}>
                      {style}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  value={newRef}
                  onChange={(event) => setNewRef(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && newRef.trim()) {
                      event.preventDefault();
                      setVisualRefs((previous) => [...previous, newRef.trim()]);
                      setNewRef("");
                    }
                  }}
                  placeholder="Add URL or description, press Enter"
                  className="flex-1 rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-3 py-2 text-sm text-[#374151] dark:text-slate-300 placeholder-slate-600 focus:border-violet-500/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newRef.trim()) {
                      setVisualRefs((previous) => [...previous, newRef.trim()]);
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
          <div className="space-y-4">
            <Field label="Logo">
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo_url}
                  alt={`${companySlug} logo`}
                  className="max-h-20 max-w-full object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-md border border-dashed border-[#E5E7EB] dark:border-[#2a2a2a] px-4 py-6 text-slate-600">
                  <ImageIcon className="h-5 w-5" />
                  Not set
                </div>
              )}
            </Field>
            <div className="flex flex-wrap gap-6">
              <ColorSwatch label="Primary" color={brand.primary_color} />
              <ColorSwatch label="Secondary" color={brand.secondary_color} />
              <ColorSwatch label="Accent" color={brand.accent_color} />
            </div>
            <Field label="Image Style">
              {brand.image_style ? (
                <span className="text-sm text-slate-100">{brand.image_style}</span>
              ) : (
                <EmptyValue />
              )}
            </Field>
            <Field label="Visual References">
              {visualReferenceUrls.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {visualReferenceUrls.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt="Visual reference"
                      className="h-16 w-16 rounded-md border border-[#E5E7EB] dark:border-[#2a2a2a] object-cover"
                    />
                  ))}
                </div>
              ) : (
                <EmptyValue />
              )}
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Platforms & Scheduling"
        editing={editingSection === "platforms"}
        saving={saving}
        onEdit={() => startEditing("platforms")}
        onCancel={cancelEditing}
        onSave={() =>
          saveSection({
            active_platforms: normalizePlatforms(platformsDraft.active_platforms),
            post_frequency: platformsDraft.post_frequency,
            preferred_times: draftPreferredTimes,
            timezone: platformsDraft.timezone,
          })
        }
      >
        {editingSection === "platforms" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Active Platforms</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <Checkbox
                      checked={(platformsDraft.active_platforms ?? []).includes(
                        platform
                      )}
                      onCheckedChange={() => togglePlatform(platform)}
                    />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Post Frequency</Label>
              <Select
                value={String(platformsDraft.post_frequency)}
                onValueChange={(value) =>
                  setPlatformsDraft((current) => ({
                    ...current,
                    post_frequency: Number(value),
                  }))
                }
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Preferred Times</Label>
              <div className="space-y-2">
                {(platformsDraft.active_platforms ?? []).map((platform) => (
                  <div
                    key={platform}
                    className="grid grid-cols-[120px_1fr] items-center gap-3"
                  >
                    <span className="text-sm text-text-muted">{platform}</span>
                    <Input
                      type="time"
                      value={draftPreferredTimes[platform] ?? "09:00"}
                      onChange={(event) =>
                        updatePreferredTime(platform, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={platformsDraft.timezone}
                onValueChange={(value) =>
                  setPlatformsDraft((current) => ({
                    ...current,
                    timezone: value,
                  }))
                }
              >
                <SelectTrigger>
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
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Active Platforms">
              {(brand.active_platforms ?? []).length > 0 ? (
                <TagList tags={brand.active_platforms ?? []} />
              ) : (
                <EmptyValue />
              )}
            </Field>
            <Field label="Zernio Connection Status">
              {(brand.active_platforms ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(brand.active_platforms ?? []).map((platform) => {
                    const connected = Boolean(
                      resolveAccountIdForPlatform(zernioAccountIds, platform)
                    );

                    return (
                      <div
                        key={platform}
                        className="flex items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#f8fafc] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] px-4 py-3"
                      >
                        <span className="text-sm text-slate-100">{platform}</span>
                        <ConnectionBadge connected={connected} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyValue />
              )}
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-[#9ca3af] dark:text-slate-500">
                  Post frequency
                </p>
                <p className="text-sm text-[#374151] dark:text-slate-300">
                  {brand.post_frequency
                    ? postFrequencyLabel
                    : "Not set"}
                </p>
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
                {Object.keys(preferredTimes).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preferredTimes).map(([platform, time]) => (
                      <span
                        key={platform}
                        className="rounded-lg border border-[#2e2e5a] bg-[#f8fafc] dark:bg-[#1f1f1f] px-2 py-1 text-xs capitalize text-[#374151] dark:text-slate-300"
                      >
                        {platform}: {time}
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
      </SectionCard>

      <SectionCard
        title="Content Mix"
        editing={editingSection === "contentMix"}
        saving={saving}
        onEdit={() => startEditing("contentMix")}
        onCancel={cancelEditing}
        onSave={() =>
          saveSection({
            promotional_pct: contentMixDraft.promotional_pct,
            educational_pct: contentMixDraft.educational_pct,
            engagement_pct: contentMixDraft.engagement_pct,
            ga_property_id: contentMixDraft.ga_property_id,
          })
        }
      >
        {editingSection === "contentMix" ? (
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Promotional ({contentMixDraft.promotional_pct}%)</Label>
                <Slider
                  value={[contentMixDraft.promotional_pct]}
                  max={100}
                  step={1}
                  onValueChange={([value]) =>
                    updateContentMix("promotional_pct", value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Educational ({contentMixDraft.educational_pct}%)</Label>
                <Slider
                  value={[contentMixDraft.educational_pct]}
                  max={100}
                  step={1}
                  onValueChange={([value]) =>
                    updateContentMix("educational_pct", value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Engagement ({contentMixDraft.engagement_pct}%)</Label>
                <Slider
                  value={[contentMixDraft.engagement_pct]}
                  max={100}
                  step={1}
                  onValueChange={([value]) =>
                    updateContentMix("engagement_pct", value)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>GA Property ID</Label>
              <Input
                value={contentMixDraft.ga_property_id ?? ""}
                onChange={(event) =>
                  setContentMixDraft((current) => ({
                    ...current,
                    ga_property_id: event.target.value || null,
                  }))
                }
                placeholder="Optional Google Analytics property ID"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
                    <div className="h-2 flex-1 rounded-full bg-[#f8fafc] dark:bg-[#1f1f1f]">
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
            <Field label="GA Property ID">
              {brand.ga_property_id ? (
                <span className="font-mono text-sm text-slate-100">
                  {brand.ga_property_id}
                </span>
              ) : (
                <EmptyValue />
              )}
            </Field>
          </div>
        )}
      </SectionCard>

      <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
            Product Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProductPhotoLibrary companySlug={companySlug} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-[#E5E7EB] dark:border-[#2a2a2a] bg-white dark:bg-[#161616] shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-[#6b7280] dark:text-slate-400">
            Holidays &amp; Occasions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-slate-600">
            Toggle occasions on or off for this client. The AI references upcoming
            enabled holidays during weekly ideation.
          </p>
          <HolidayCalendar companySlug={companySlug} />
        </CardContent>
      </Card>
    </div>
  );
}
