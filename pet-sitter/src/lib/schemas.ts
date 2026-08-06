import { z } from 'zod';

/** POST /api/assistant body. */
export const AssistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(500)
});

/** Query params for GET /api/sitters. */
export const SittersQuerySchema = z.object({
  q: z.string().max(100).optional(),
  neighbourhood: z.string().max(100).optional(),
  pet_type: z.string().max(100).optional(),
  max_rate: z.coerce.number().finite().nonnegative().optional()
});

/** Auth body for register / sign-in / sign-out. */
export const AuthBodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('sign-out')
  }),
  z.object({
    action: z.literal('register'),
    email: z.string().email().max(200),
    password: z.string().min(10).max(200),
    display_name: z.string().max(80).optional()
  }),
  z.object({
    action: z.literal('sign-in'),
    email: z.string().email().max(200),
    password: z.string().min(10).max(200)
  })
]);

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type SittersQuery = z.infer<typeof SittersQuerySchema>;
export type AuthBody = z.infer<typeof AuthBodySchema>;
