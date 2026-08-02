import { z } from 'zod';
import type { AppContext } from '../lib/env';
import {
  getCropsByIds,
  getWindowsForHalf,
  listCrops,
  type CropRow,
  type WindowWithSource
} from '../lib/db';
import { halfMonthLabel } from '../lib/dates';
import {
  errorJson,
  isErrorResponse,
  json,
  optionsResponse,
  rateLimitJson,
  readJsonBody
} from '../lib/http';
import {
  checkAndConsumeRateLimit,
  clientKeyFromRequest
} from '../lib/rateLimit';

/**
 * Workers AI model for turning a gardening sentence into filter values only.
 *
 * `@cf/meta/llama-3.1-8b-instruct` was deprecated and returned AiError 5028;
 * verified working id is llama-3.3-70b-instruct-fp8-fast.
 */
const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Workers AI text response, in either shape.
 *
 * Older models return `{ response }`. Current ones return OpenAI-style
 * `{ choices: [{ message: { content } }] }` and may leave `response` empty.
 */
export interface ModelResult {
  readonly response?: string;
  readonly choices?: readonly {
    readonly message?: { readonly content?: string };
  }[];
}

/**
 * Pull the generated text out of whichever shape the model used.
 *
 * @param result - Raw Workers AI result.
 * @returns The text, or an empty string when there genuinely is none.
 */
export function modelText(result: ModelResult): string {
  const chat = result.choices?.[0]?.message?.content;
  if (typeof chat === 'string' && chat.trim() !== '') return chat;
  return typeof result.response === 'string' ? result.response : '';
}

const AssistantBodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  zone: z.string().trim().min(1).max(80).optional()
});

/** Filters the model is allowed to emit (never used as SQL text). */
export const AssistantFiltersSchema = z
  .object({
    half_month: z.number().int().min(0).max(23).optional(),
    method: z.enum(['S', 'T']).optional(),
    crop: z.string().trim().min(1).max(100).optional()
  })
  .strict();

export type AssistantFilters = z.infer<typeof AssistantFiltersSchema>;

const SYSTEM_PROMPT = `You convert a low-desert gardening question into filter values for AZ Planting Calendar.
Return ONLY a single JSON object, no markdown, no commentary, no prose answers.
Allowed keys (omit any you cannot set confidently):
- half_month: integer 0..23 (0=Jan early, 1=Jan late, 2=Feb early, ... 14=Aug early, 15=Aug late, 23=Dec late)
- method: "S" for seed only, "T" for transplant only
- crop: short crop name fragment if a specific crop is named (e.g. "tomato", "lettuce")
Never invent horticultural advice. Prefer {} if nothing is clear.
"early August" / "first half of August" => half_month 14
"late August" / "second half of August" => half_month 15
"transplant tomatoes" => method "T", crop "tomato"
"seed lettuce" => method "S", crop "lettuce"`;

/**
 * Extract a JSON object from model text (raw or fenced).
 *
 * @param text - Model response text.
 * @returns Parsed unknown value.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as unknown;
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error('No JSON object in model output');
  }
}

/**
 * Crop list item returned to the client after grounding.
 */
export interface AssistantCrop {
  id: string;
  name: string;
  methods: Array<'S' | 'T'>;
}

/**
 * Build a human answer string from real D1-derived crop rows (never model prose).
 *
 * @param crops - Grounded crop rows with methods.
 * @param filters - Validated filter values used for the query.
 * @returns Plain-language summary.
 */
export function buildAnswer(crops: AssistantCrop[], filters: AssistantFilters): string {
  const n = crops.length;
  const cropWord = n === 1 ? 'crop' : 'crops';
  const parts: string[] = [];

  if (filters.half_month !== undefined) {
    const label = halfMonthLabel(filters.half_month);
    const halfPhrase = halfMonthPhrase(filters.half_month);
    if (filters.method === 'S') {
      parts.push(
        n === 0
          ? `No crops are listed for seeding during the ${halfPhrase} of ${label.split(' ')[0]}.`
          : `${n} ${cropWord} can be seeded during the ${halfPhrase} (${label}).`
      );
    } else if (filters.method === 'T') {
      parts.push(
        n === 0
          ? `No crops are listed for transplanting during the ${halfPhrase} of ${label.split(' ')[0]}.`
          : `${n} ${cropWord} can be transplanted during the ${halfPhrase} (${label}).`
      );
    } else {
      parts.push(
        n === 0
          ? `No crops are listed as plantable during the ${halfPhrase} (${label}).`
          : `${n} ${cropWord} can go in during the ${halfPhrase} (${label}).`
      );
    }
  } else if (filters.crop) {
    if (n === 0) {
      parts.push(
        `No crops matching "${filters.crop}" were found in this app's database.`
      );
    } else if (filters.method === 'S') {
      parts.push(
        `${n} ${cropWord} matching "${filters.crop}" have seed windows on file.`
      );
    } else if (filters.method === 'T') {
      parts.push(
        `${n} ${cropWord} matching "${filters.crop}" have transplant windows on file.`
      );
    } else {
      parts.push(
        `${n} ${cropWord} matching "${filters.crop}" ${n === 1 ? 'is' : 'are'} in the calendar.`
      );
    }
  } else if (filters.method) {
    const methodLabel = filters.method === 'S' ? 'seed' : 'transplant';
    parts.push(
      n === 0
        ? `No crops with ${methodLabel} windows were found.`
        : `${n} ${cropWord} have ${methodLabel} windows in this calendar.`
    );
  } else {
    parts.push(
      n === 0
        ? 'No crops matched. Try naming a crop or a half-month (for example early August).'
        : `${n} ${cropWord} are in this calendar. Ask about a half-month or a crop name for a narrower list.`
    );
  }

  if (n > 0 && n <= 8) {
    parts.push(`Listed: ${crops.map((c) => c.name).join(', ')}.`);
  } else if (n > 8) {
    parts.push(
      `Examples: ${crops
        .slice(0, 6)
        .map((c) => c.name)
        .join(', ')}, and more.`
    );
  }

  parts.push('Windows come from UA Cooperative Extension az1005 for Maricopa County.');
  return parts.join(' ');
}

/**
 * Human half phrase for a half-month index.
 *
 * @param half - 0..23.
 */
function halfMonthPhrase(half: number): string {
  return half % 2 === 0 ? 'first half' : 'second half';
}

/**
 * Collect unique crop ids and method sets from windows for one half-month.
 *
 * @param windows - Active windows for the half.
 * @param method - Optional method filter already applied in SQL when set.
 */
function cropsFromWindows(windows: WindowWithSource[]): Map<string, Set<'S' | 'T'>> {
  const map = new Map<string, Set<'S' | 'T'>>();
  for (const w of windows) {
    const set = map.get(w.crop_id) ?? new Set<'S' | 'T'>();
    set.add(w.method);
    map.set(w.crop_id, set);
  }
  return map;
}

/**
 * Ground validated filters against D1 and return crops + answer.
 * Model text never reaches SQL.
 *
 * @param db - D1 binding.
 * @param filters - Zod-validated filters from the model.
 */
export async function groundFilters(
  db: D1Database,
  filters: AssistantFilters
): Promise<{ crops: AssistantCrop[]; answer: string }> {
  let crops: AssistantCrop[] = [];

  if (filters.half_month !== undefined) {
    const windows = await getWindowsForHalf(db, filters.half_month, filters.method);
    const byId = cropsFromWindows(windows);
    const cropRows = await getCropsByIds(db, [...byId.keys()]);
    crops = [...byId.entries()]
      .map(([id, methods]) => {
        const row = cropRows.get(id);
        if (!row) return null;
        return {
          id: row.id,
          name: row.name,
          methods: [...methods].sort() as Array<'S' | 'T'>
        };
      })
      .filter((c): c is AssistantCrop => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (filters.crop) {
      const needle = filters.crop.toLowerCase();
      crops = crops.filter((c) => c.name.toLowerCase().includes(needle));
    }
  } else if (filters.crop) {
    const listed = await listCrops(db, filters.crop);
    const cropRows: CropRow[] = listed;
    if (filters.method) {
      // Keep only crops that have at least one window of that method.
      const withMethod: AssistantCrop[] = [];
      for (const row of cropRows) {
        const windows = await getWindowsForCropMethod(db, row.id, filters.method);
        if (windows > 0) {
          withMethod.push({ id: row.id, name: row.name, methods: [filters.method] });
        }
      }
      crops = withMethod;
    } else {
      crops = cropRows.map((row) => ({
        id: row.id,
        name: row.name,
        methods: [] as Array<'S' | 'T'>
      }));
    }
  } else if (filters.method) {
    // No half and no crop: list crops that have any window of that method via list + filter.
    const listed = await listCrops(db);
    const withMethod: AssistantCrop[] = [];
    for (const row of listed) {
      const count = await getWindowsForCropMethod(db, row.id, filters.method);
      if (count > 0) {
        withMethod.push({ id: row.id, name: row.name, methods: [filters.method] });
      }
    }
    crops = withMethod;
  } else {
    const listed = await listCrops(db);
    crops = listed.map((row) => ({
      id: row.id,
      name: row.name,
      methods: [] as Array<'S' | 'T'>
    }));
  }

  return { crops, answer: buildAnswer(crops, filters) };
}

/**
 * Count windows for a crop with a given method (parameterized).
 *
 * @param db - D1 binding.
 * @param cropId - Crop id.
 * @param method - S or T.
 */
async function getWindowsForCropMethod(
  db: D1Database,
  cropId: string,
  method: 'S' | 'T'
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM planting_windows WHERE crop_id = ? AND method = ?`
    )
    .bind(cropId, method)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * POST /api/assistant — map natural language to filters, ground in D1, return answer.
 * Model output is Zod-validated only; never used as SQL text or horticultural prose.
 * Rate-limited per client IP (or a shared fail-closed bucket when IP is absent)
 * before any paid inference runs.
 */
export async function onRequestPost(context: AppContext): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return errorJson(request, 'Database binding unavailable', 503);
  }

  // Rate limit first -- refuse abusive volume before body parse or AI cost.
  try {
    const clientKey = clientKeyFromRequest(request);
    const limitResult = await checkAndConsumeRateLimit(env.DB, clientKey);
    if (!limitResult.allowed) {
      const retryAfter = limitResult.retryAfterSeconds ?? 60;
      return rateLimitJson(request, retryAfter, 'POST, OPTIONS');
    }
  } catch (cause) {
    // Fail closed: cannot verify quota => do not call paid AI.
    const detail = String(cause).slice(0, 200);
    return errorJson(
      request,
      `Rate limit check failed: ${detail}`,
      503
    );
  }

  if (!env.AI) {
    return errorJson(request, 'Assistant binding unavailable (AI missing)', 503);
  }

  const parsedBody = await readJsonBody(request, AssistantBodySchema, 'Invalid message');
  if (isErrorResponse(parsedBody)) return parsedBody;

  let rawText: string;
  try {
    const result = (await env.AI.run(ASSISTANT_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parsedBody.message }
      ],
      max_tokens: 200
    })) as ModelResult;

    rawText = modelText(result);
  } catch (cause) {
    const detail = String(cause).slice(0, 200);
    return errorJson(
      request,
      `Assistant model failed (${ASSISTANT_MODEL}): ${detail}`,
      502
    );
  }

  if (!rawText.trim()) {
    return errorJson(
      request,
      `Assistant model failed (${ASSISTANT_MODEL}): empty output`,
      502
    );
  }

  let candidate: unknown;
  try {
    candidate = extractJsonObject(rawText);
  } catch {
    return errorJson(request, 'Assistant returned invalid JSON', 422);
  }

  const parsedFilters = AssistantFiltersSchema.safeParse(candidate);
  if (!parsedFilters.success) {
    return errorJson(request, 'Assistant output failed validation', 422);
  }

  try {
    const { crops, answer } = await groundFilters(env.DB, parsedFilters.data);
    if (!answer.trim()) {
      return errorJson(request, 'Failed to build grounded answer', 500);
    }
    return json(
      request,
      {
        answer,
        crops,
        filters: parsedFilters.data
      },
      200,
      'POST, OPTIONS'
    );
  } catch (cause) {
    const detail = String(cause).slice(0, 200);
    return errorJson(request, `Failed to ground assistant answer: ${detail}`, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: AppContext): Response {
  return optionsResponse(context.request, 'POST, OPTIONS');
}
