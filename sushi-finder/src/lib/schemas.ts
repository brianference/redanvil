import { z } from 'zod';

/** Public sushi row (API response shape, PRD §7.2). */
export const SushiRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
export type SushiRow = z.infer<typeof SushiRowSchema>;

/** POST /api/sushis body. Title required and non-empty after trim. */
export const SushiCreateSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required')
    .max(200),
  description: z.string().max(4000).optional().default('')
});
export type SushiCreate = z.infer<typeof SushiCreateSchema>;

/** PUT/PATCH /api/sushis/:id body — at least one field. */
export const SushiUpdateSchema = z
  .object({
    title: z.string().trim().min(1, 'title is required').max(200).optional(),
    description: z.string().max(4000).optional()
  })
  .refine((value) => value.title !== undefined || value.description !== undefined, {
    message: 'at least one of title or description is required'
  });
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
