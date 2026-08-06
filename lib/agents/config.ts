import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL =
  process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const DEFAULT_SUPPORTED_SEARCH_COUNTRIES = [
  "US",
  "GB",
  "CA",
  "AU",
  "DE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "SE",
  "NO",
  "DK",
  "FI",
  "AT",
  "CH",
  "PL",
  "PT",
  "MX",
  "BR",
  "IN",
  "JP",
  "NZ",
  "IE",
] as const;

function parseSupportedSearchCountries(): readonly string[] {
  const raw = process.env.SUPPORTED_SEARCH_COUNTRIES?.trim();
  if (!raw) {
    return DEFAULT_SUPPORTED_SEARCH_COUNTRIES;
  }

  return raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0);
}

export const SUPPORTED_SEARCH_COUNTRIES = parseSupportedSearchCountries();

export function isSupportedSearchCountry(country: string): boolean {
  const normalized = country.trim().toUpperCase();
  if (!normalized) {
    return false;
  }

  return SUPPORTED_SEARCH_COUNTRIES.includes(normalized);
}

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY.");
  }

  return new Anthropic({ apiKey });
}
