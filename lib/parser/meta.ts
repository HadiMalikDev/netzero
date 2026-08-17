import { chatJSON, hasLLM } from "@/lib/ai/openrouter";
import { detectScheme } from "./mostadam";

/**
 * Catalog metadata (org / scheme / stage / version) for an uploaded manual.
 * Detection is offloaded to the LLM — the manual's cover and title extract
 * poorly, so regex is unreliable. The deterministic `detectScheme` provides a
 * safe fallback for scheme/stage when the LLM is unavailable or unsure.
 */
export interface ManualMeta {
  ratingSystemName: string;
  ratingSystemKey: string;
  authority: string | null;
  country: string | null;
  scheme: string | null; // residential | commercial | communities
  stage: string | null; // D+C | O+E
  versionLabel: string;
}

const SYSTEM = `You extract catalog metadata from the text of a green-building rating-system manual.
Return ONLY JSON with these keys:
{"rating_system_name","rating_system_key","authority","country","scheme","stage","version_label"}
Rules:
- rating_system_name: the scheme's brand/org name (e.g. "Mostadam").
- rating_system_key: a lowercase slug of that name (e.g. "mostadam").
- authority / country: the issuing body and country if stated, else null.
- scheme: exactly one of "residential" | "commercial" | "communities" (lowercase), else null.
- stage: exactly "D+C" (Design & Construction) or "O+E" (Operation & Existing), else null.
- version_label: the manual's version/edition label, e.g. "2019". Use null if the text does not clearly state it — do NOT guess a year.
Extract only what the text supports.`;

function normScheme(v: unknown): string | null {
  const s = String(v ?? "").toLowerCase();
  return ["residential", "commercial", "communities"].includes(s) ? s : null;
}

function normStage(v: unknown): string | null {
  const s = String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (s === "D+C") return "D+C";
  if (s === "O+E") return "O+E";
  return null;
}

function slug(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function detectManualMeta(fullText: string): Promise<ManualMeta> {
  const det = detectScheme(fullText);
  const fallback: ManualMeta = {
    ratingSystemName: "Mostadam",
    ratingSystemKey: "mostadam",
    authority: "Ministry of Municipal and Rural Affairs and Housing",
    country: "Saudi Arabia",
    scheme: det.scheme,
    stage: det.stage,
    versionLabel: "unspecified",
  };
  if (!hasLLM()) return fallback;

  try {
    const res = await chatJSON<{
      rating_system_name?: string;
      rating_system_key?: string;
      authority?: string | null;
      country?: string | null;
      scheme?: string | null;
      stage?: string | null;
      version_label?: string | null;
    }>(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          // Title / TOC / intro pages carry the scheme, stage, version, and org.
          content: `MANUAL TEXT (excerpt):\n${fullText.slice(0, 14000)}`,
        },
      ],
      { maxTokens: 300 },
    );

    const name = (res.rating_system_name || fallback.ratingSystemName).trim();
    const version = (res.version_label ?? "").toString().trim();
    return {
      ratingSystemName: name,
      ratingSystemKey: res.rating_system_key
        ? slug(res.rating_system_key)
        : slug(name),
      authority: res.authority?.toString().trim() || fallback.authority,
      country: res.country?.toString().trim() || fallback.country,
      // Prefer the LLM, but fall back to the deterministic detector.
      scheme: normScheme(res.scheme) ?? det.scheme,
      stage: normStage(res.stage) ?? det.stage,
      versionLabel: version || fallback.versionLabel,
    };
  } catch {
    return fallback;
  }
}
