import {
  IMAGE_STYLES,
  PLATFORMS,
  TONES,
} from "@/lib/validations/onboard";

const JSON_ARRAY_ARTIFACTS = new Set(["[]", '[""]', "['']", '[""]', "[]"]);

function isEmptyArrayArtifact(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  if (JSON_ARRAY_ARTIFACTS.has(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.every(
          (item) => typeof item !== "string" || item.trim().length === 0
        );
      }
    } catch {
      return false;
    }
  }

  return false;
}

function cleanTagValue(value: string): string {
  return value.trim().replace(/^@+/, "");
}

function isRenderableTag(value: string): boolean {
  const cleaned = cleanTagValue(value);
  return cleaned.length > 0 && cleaned !== "[]" && !isEmptyArrayArtifact(cleaned);
}

function parsePostgresArrayLiteral(trimmed: string): string[] | null {
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const items: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      const item = cleanTagValue(current);
      if (isRenderableTag(item)) {
        items.push(item);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const lastItem = cleanTagValue(current);
  if (isRenderableTag(lastItem)) {
    items.push(lastItem);
  }

  return items;
}

function flattenNormalizedTags(items: string[]): string[] {
  return items.flatMap((item) => normalizeStringArray(item));
}

export function normalizeStringArray(
  value: string | string[] | null | undefined
): string[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => cleanTagValue(String(item)))
      .filter(isRenderableTag);

    return flattenNormalizedTags(normalized);
  }

  const trimmed = value.trim();
  if (!trimmed || isEmptyArrayArtifact(trimmed)) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => cleanTagValue(String(item)))
          .filter(isRenderableTag);
      }
    } catch {
      // Fall through to other parsers.
    }
  }

  const postgresArray = parsePostgresArrayLiteral(trimmed);
  if (postgresArray !== null) {
    return postgresArray;
  }

  return trimmed
    .split(",")
    .map((item) => cleanTagValue(item))
    .filter(isRenderableTag);
}

export function normalizeIndustries(
  value: string | string[] | null | undefined
): string[] {
  return normalizeStringArray(value);
}

export function formatIndustries(
  value: string | string[] | null | undefined,
  fallback = "not specified"
): string {
  const industries = normalizeIndustries(value);
  return industries.length > 0 ? industries.join(", ") : fallback;
}

export function normalizeTone(value: string): (typeof TONES)[number] {
  return (
    TONES.find((item) => item.toLowerCase() === value.toLowerCase()) ??
    (value as (typeof TONES)[number])
  );
}

export function normalizeImageStyle(
  value: string
): (typeof IMAGE_STYLES)[number] {
  return (
    IMAGE_STYLES.find((item) => item.toLowerCase() === value.toLowerCase()) ??
    (value as (typeof IMAGE_STYLES)[number])
  );
}

export function normalizePlatform(
  value: string
): (typeof PLATFORMS)[number] {
  return (
    PLATFORMS.find((item) => item.toLowerCase() === value.toLowerCase()) ??
    (value as (typeof PLATFORMS)[number])
  );
}

export function normalizePlatforms(
  values: string[] | null | undefined
): (typeof PLATFORMS)[number][] {
  return normalizeStringArray(values).map(normalizePlatform);
}
