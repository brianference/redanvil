import { AssistantRequestSchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { listSitters, type SitterRow } from '../lib/db';
import { errorJson, json, optionsResponse, parseJsonBody, requireDb } from '../lib/http';

/** Workers AI model id for filter extraction. */
const ASSISTANT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Workers AI text result shapes. */
interface ModelResult {
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
function modelText(result: ModelResult): string {
  const chat = result.choices?.[0]?.message?.content;
  if (typeof chat === 'string' && chat.trim() !== '') return chat;
  return typeof result.response === 'string' ? result.response : '';
}

const SYSTEM_PROMPT = `You convert a pet-sitting question into search filters for Pet Sitter Finder.
Return ONLY a single JSON object, no markdown, no commentary.
Allowed keys (omit any you cannot set confidently):
- q: short free-text fragment (neighbourhood name, pet type, or sitter trait)
- neighbourhood: exact Toronto neighbourhood if named (e.g. "Leslieville", "The Annex")
- pet_type: one of "dogs", "cats", "small mammals" when clear
- max_rate: integer CAD per night ceiling when the user states a budget
Prefer {} if nothing is clear. Never invent sitters or rates.`;

/**
 * Build an answer from real D1 sitter rows (never model prose as ground truth).
 *
 * @param sitters - Grounded rows.
 * @param filters - Filters used for the query.
 */
function buildAnswer(sitters: SitterRow[], filters: Record<string, unknown>): string {
  const n = sitters.length;
  if (n === 0) {
    return (
      'No sitters matched those filters in the local catalog. ' +
      'Try a broader neighbourhood, a higher rate ceiling, or a different pet type.'
    );
  }
  const top = sitters.slice(0, 5);
  const lines = top.map(
    (s) =>
      `${s.name} in ${s.neighbourhood}: $${s.rate_per_night}/night, accepts ${s.pet_types}, ${s.verified_reviews} verified reviews`
  );
  const filterNote =
    Object.keys(filters).length > 0
      ? ` Using filters: ${JSON.stringify(filters)}.`
      : '';
  return (
    `Found ${n} sitter${n === 1 ? '' : 's'} in the app database.${filterNote}\n` +
    lines.join('\n')
  );
}

/**
 * Extract a JSON object from model text.
 *
 * @param text - Model response text.
 */
function extractJsonObject(text: string): unknown {
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
 * POST /api/assistant — Workers AI + D1-grounded sitter answers.
 */
export async function onRequestPost(context: AppContext): Promise<Response> {
  try {
    const missingDb = requireDb(context.request, context.env.DB);
    if (missingDb) return missingDb;
    if (!context.env.AI) {
      return errorJson(context.request, 'AI binding unavailable', 503);
    }

    const bodyResult = await parseJsonBody(
      context.request,
      AssistantRequestSchema,
      'message must be 1–500 characters'
    );
    if (!bodyResult.ok) return bodyResult.response;
    const message = bodyResult.value.message;

    let filters: Record<string, unknown> = {};
    try {
      const result = (await context.env.AI.run(ASSISTANT_MODEL, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message }
        ]
      })) as ModelResult;
      const text = modelText(result);
      const parsed = extractJsonObject(text);
      if (parsed && typeof parsed === 'object') {
        filters = parsed as Record<string, unknown>;
      }
    } catch {
      return errorJson(
        context.request,
        'The assistant model failed. Try again in a moment.',
        502
      );
    }

    const q = typeof filters.q === 'string' ? filters.q : undefined;
    const neighbourhood =
      typeof filters.neighbourhood === 'string' ? filters.neighbourhood : undefined;
    const petType = typeof filters.pet_type === 'string' ? filters.pet_type : undefined;
    const maxRate =
      typeof filters.max_rate === 'number' && Number.isFinite(filters.max_rate)
        ? filters.max_rate
        : undefined;

    const sitters = await listSitters(context.env.DB, q, neighbourhood, petType, maxRate);
    const answer = buildAnswer(sitters, {
      ...(q ? { q } : {}),
      ...(neighbourhood ? { neighbourhood } : {}),
      ...(petType ? { pet_type: petType } : {}),
      ...(maxRate !== undefined ? { max_rate: maxRate } : {})
    });

    return json(
      context.request,
      {
        answer,
        sitters: sitters.slice(0, 8).map((s) => ({
          id: s.id,
          name: s.name,
          neighbourhood: s.neighbourhood,
          rate_per_night: s.rate_per_night,
          pet_types: s.pet_types,
          verified_reviews: s.verified_reviews
        })),
        filters
      },
      200,
      'POST, OPTIONS'
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'assistant failed';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'POST, OPTIONS');
}
