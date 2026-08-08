import { z } from 'zod';

/** Style facet stored on D1 rows (FEATURES rank 4). */
export const SushiStyleSchema = z.enum(['omakase', 'conveyor', 'counter', '']);
export type SushiStyle = z.infer<typeof SushiStyleSchema>;

/** Public sushi row (API response shape, PRD §7.2 + discovery fields). */
export const SushiRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  style: z.string().default(''),
  priceBand: z.string().default(''),
  walkIn: z.boolean().default(false),
  city: z.string().default(''),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  photoUrl: z.string().default('')
});
export type SushiRow = z.infer<typeof SushiRowSchema>;

/** POST /api/sushis body. Title required and non-empty after trim. */
export const SushiCreateSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required')
    .max(200),
  description: z.string().max(4000).optional().default(''),
  style: z.string().max(40).optional().default(''),
  priceBand: z.string().max(20).optional().default(''),
  walkIn: z.boolean().optional().default(false),
  city: z.string().max(80).optional().default(''),
  lat: z.number().min(-90).max(90).nullable().optional().default(null),
  lng: z.number().min(-180).max(180).nullable().optional().default(null),
  photoUrl: z.string().max(400).optional().default('')
});
export type SushiCreate = z.infer<typeof SushiCreateSchema>;

/** PUT/PATCH /api/sushis/:id body — at least one field. */
export const SushiUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200).optional(),
    description: z.string().max(4000).optional(),
    style: z.string().max(40).optional(),
    priceBand: z.string().max(20).optional(),
    walkIn: z.boolean().optional(),
    city: z.string().max(80).optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    photoUrl: z.string().max(400).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.style !== undefined ||
      value.priceBand !== undefined ||
      value.walkIn !== undefined ||
      value.city !== undefined ||
      value.lat !== undefined ||
      value.lng !== undefined ||
      value.photoUrl !== undefined,
    {
      message: 'at least one field is required'
    }
  );
export type SushiUpdate = z.infer<typeof SushiUpdateSchema>;

/** GET /api/sushis list response. */
export const SushiListResponseSchema = z.object({
  items: z.array(SushiRowSchema)
});
export type SushiListResponse = z.infer<typeof SushiListResponseSchema>;

/** Optional title search query. */
export const SushisQuerySchema = z.object({
  q: z
    .string()
    .max(100)
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    })
});
export type SushisQuery = z.infer<typeof SushisQuerySchema>;

/** Path id for /api/sushis/:id. */
export const SushiIdSchema = z.string().min(1).max(80);

/** POST /api/assistant body. */
export const AssistantRequestSchema = z.object({
  message: z
    .string({ required_error: 'message is required' })
    .trim()
    .min(1, 'message is required')
    .max(500)
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/** Filters the assistant model may emit (validated server-side). */
export const AssistantFiltersSchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional()
  })
  .strict();
export type AssistantFilters = z.infer<typeof AssistantFiltersSchema>;

/** POST /api/assistant success response — answer is built from D1, not model prose. */
export const AssistantResponseSchema = z.object({
  answer: z.string().min(1),
  items: z.array(SushiRowSchema),
  filters: AssistantFiltersSchema
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/** Health probe. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok')
});
