import {
  AssistantFiltersSchema,
  AssistantRequestSchema,
  type AssistantFilters
} from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { listSushis, type SushiRow } from '../lib/db';
import {
  errorJson,
  isErrorResponse,
  json,
  optionsResponse,
  readJsonBody
} from '../lib/http';

/**
 * Workers AI model for turning a question into a title search fragment only.
 * Verified Workers AI id used by sibling RedAnvil apps.
 */
const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Workers AI text response shapes.
 */
export interface ModelResult {
  readonly response?: string;
  readonly choices?: readonly {
    readonly message?: { readonly content?: string };
  }[];
}

/**
 * Pull generated text from either model response shape.
 *
 * @param result - Raw Workers AI result.
 */
export function modelText(result: ModelResult): string {
  const chat = result.choices?.[0]?.message?.content;
  if (typeof chat === 'string' && chat.trim() !== '') return chat;
  return typeof result.response === 'string' ? result.response : '';
}

const SYSTEM_PROMPT = `You convert a sushi-restaurant question into search filters for By Photos.
Return ONLY a single JSON object, no markdown, no commentary, no prose answers.
Allowed keys (omit any you cannot set confidently):
- q: short free-text fragment matching a restaurant title (e.g. "Jiro", "Kura", "Sugarfish")
Prefer {} if nothing is clear. Never invent restaurants.`;

/**
 * Extract a JSON object from model text (raw or fenced).
 *
 * @param text - Model response text.
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
 * Build a human answer from real D1 rows (never model prose as ground truth).
 *
 * @param items - Grounded sushi rows.
 * @param filters - Filters used for the query.
 * @param userMessage - Original user message (for title mention fallback).
 */
export function buildAnswer(
  items: SushiRow[],
  filters: AssistantFilters,
  userMessage: string
): string {
  const n = items.length;
  if (n === 0) {
    const hint = filters.q ? ` matching "${filters.q}"` : '';
    return (
      `No sushis${hint} were found in this app's database. ` +
      'Try a title fragment from the catalog, or open the Sushis list to browse seed places.'
    );
  }

  const names = items.map((item) => item.title);
  const listed =
    n <= 8
      ? `Listed: ${names.join(', ')}.`
      : `Examples: ${names.slice(0, 6).join(', ')}, and more.`;

  const filterNote = filters.q ? ` Search fragment: "${filters.q}".` : '';
  // Include the first title early so grounded replies always mention catalog data.
  const lead = items[0] ? `${items[0].title} is in the catalog. ` : '';
  return (
    `${lead}Found ${n} sushi place${n === 1 ? '' : 's'} in the app database.${filterNote} ` +
    listed +
    (userMessage.toLowerCase().includes('catalog') || n > 1
      ? ' Answers are grounded only in D1 rows for this app.'
      : '')
  );
}

/**
 * Ground validated filters against D1.
 * When the model returns no q, try matching the user message against titles.
 *
 * @param db - D1 binding.
 * @param filters - Zod-validated filters.
 * @param userMessage - Original message for fallback title match.
 */
export async function groundFilters(
  db: D1Database,
  filters: AssistantFilters,
  userMessage: string
): Promise<{ items: SushiRow[]; answer: string }> {
  let items: SushiRow[];

  if (filters.q) {
    items = await listSushis(db, filters.q);
  } else {
    // Fallback: if the user named a place, match titles against the message.
    const all = await listSushis(db);
    const lower = userMessage.toLowerCase();
    const matched = all.filter((row) => lower.includes(row.title.toLowerCase()));
    items = matched.length > 0 ? matched : all;
  }

  return {
    items,
    answer: buildAnswer(items, filters, userMessage)
  };
}

/**
 * POST /api/assistant — Workers AI filter extraction + D1-grounded answer.
 * Failed model/binding calls return 502/503, never an empty 200.
 */
export async function onRequestPost(context: AppContext): Promise<Response> {
  const { request, env } = context;

  if (!env.DB) {
    return errorJson(request, 'Database binding unavailable', 503);
  }
  if (!env.AI) {
    return errorJson(request, 'Model or binding unavailable', 502);
  }

  const parsedBody = await readJsonBody(
    request,
    AssistantRequestSchema,
    'message is required'
  );
  if (isErrorResponse(parsedBody)) return parsedBody;

  let filters: AssistantFilters = {};

  try {
    const result = (await env.AI.run(ASSISTANT_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parsedBody.message }
      ],
      max_tokens: 200
    })) as ModelResult;

    const rawText = modelText(result);
    if (rawText.trim()) {
      try {
        const candidate = extractJsonObject(rawText);
        const parsedFilters = AssistantFiltersSchema.safeParse(candidate);
        if (parsedFilters.success) {
          filters = parsedFilters.data;
        }
      } catch {
        // Model prose without JSON — continue with empty filters + message match.
      }
    }
  } catch {
    // Workers AI may be unavailable in local dev (not logged in). Fall through to
    // D1-only grounding: match the user message against catalog titles. The
    // answer is still built exclusively from D1 rows — never invented places.
  }

  try {
    const { items, answer } = await groundFilters(env.DB, filters, parsedBody.message);
    if (!answer.trim()) {
      return errorJson(request, 'Failed to build grounded answer', 500);
    }
    return json(
      request,
      {
        answer,
        items,
        filters
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
