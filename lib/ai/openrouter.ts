/**
 * Thin OpenRouter client. Used by the parser's AI-shape step and the grounded
 * assistant. Both callers must treat the model as a formatter, never a source of
 * truth: prompts are constrained and outputs are validated by the caller.
 *
 * Model is chosen via the verify-first check (see scripts/verify-openrouter.ts)
 * and pinned in env. If no key is present, `hasLLM()` is false and callers fall
 * back to their deterministic stub paths.
 */

const BASE = "https://openrouter.ai/api/v1/chat/completions";

export function hasLLM(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

function models(): string[] {
  const primary = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free";
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL;
  return fallback ? [primary, fallback] : [primary];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

/** Low-level call returning the assistant text. Tries fallback model on error. */
export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  let lastErr: unknown;
  for (const model of models()) {
    // Free-tier providers rate-limit (429) under load; retry the same model a
    // few times with backoff before falling to the next.
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(BASE, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://netzero.local",
            "X-Title": "NetZero",
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: opts.maxTokens ?? 1024,
            temperature: opts.temperature ?? 0,
            ...(opts.json
              ? { response_format: { type: "json_object" } }
              : {}),
          }),
          signal: opts.signal,
        });

        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`OpenRouter ${res.status} (${model})`);
          await sleep(800 * (attempt + 1) + Math.floor(attempt * 400));
          continue; // retry same model
        }
        if (!res.ok) {
          lastErr = new Error(
            `OpenRouter ${res.status} (${model}): ${await res.text()}`,
          );
          break; // non-retryable → try next model
        }

        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
          error?: { message?: string };
        };
        if (data.error) {
          lastErr = new Error(data.error.message || "OpenRouter error");
          break;
        }
        const content = data.choices?.[0]?.message?.content;
        if (typeof content === "string") return content;
        lastErr = new Error("OpenRouter: empty response");
        break;
      } catch (e) {
        lastErr = e;
        await sleep(500 * (attempt + 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call expecting a JSON object; parses (tolerating ```json fences). */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: Omit<ChatOptions, "json"> = {},
): Promise<T> {
  const raw = await chat(messages, { ...opts, json: true });
  return parseJSON<T>(raw);
}

function parseJSON<T = unknown>(raw: string): T {
  let s = raw.trim();
  // Strip markdown fences if the model added them despite json mode.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  // Fall back to the first {...} block.
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const brace = s.indexOf("{");
    if (brace >= 0) s = s.slice(brace);
  }
  return JSON.parse(s) as T;
}
