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

/** Minimum password length enforced by the auth API. */
export const PASSWORD_MIN_LENGTH = 12;

/** Maximum password length enforced by the auth API. */
export const PASSWORD_MAX_LENGTH = 200;

/** GET /api/auth/session. */
export const SessionResponseSchema = z.object({
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  enabled: z.boolean()
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/** POST /api/auth/register success. */
export const RegisterResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string(),
  emailVerified: z.boolean()
});
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

/** POST /api/auth/login success. */
export const LoginResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string()
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

/** POST /api/auth/confirm and password reset success. */
export const AuthOkEmailSchema = z.object({
  ok: z.literal(true),
  email: z.string().nullable()
});
export type AuthOkEmail = z.infer<typeof AuthOkEmailSchema>;

/** POST /api/auth/signout, reset-request, and contact success. */
export const OkResponseSchema = z.object({
  ok: z.literal(true)
});
export type OkResponse = z.infer<typeof OkResponseSchema>;

/** Marketplace role stored on the users row. */
export const AccountRoleSchema = z.enum(['owner', 'sitter']);
export type AccountRole = z.infer<typeof AccountRoleSchema>;

/** Profile fields returned with the shortlist. */
export const AccountProfileSchema = z.object({
  display_name: z.string().nullable(),
  role: AccountRoleSchema.nullable()
});
export type AccountProfile = z.infer<typeof AccountProfileSchema>;

/** One shortlisted sitter for the signed-in user. */
export const ShortlistItemSchema = z.object({
  sitter_id: z.string().min(1),
  name: z.string().min(1),
  neighbourhood: z.string(),
  rate_per_night: z.number(),
  added_at: z.number(),
  note: z.string().nullable()
});
export type ShortlistItem = z.infer<typeof ShortlistItemSchema>;

/** GET /api/shortlist. */
export const ShortlistResponseSchema = z.object({
  profile: AccountProfileSchema,
  items: z.array(ShortlistItemSchema)
});
export type ShortlistResponse = z.infer<typeof ShortlistResponseSchema>;

/** PATCH /api/shortlist profile response. */
export const ProfileResponseSchema = z.object({
  profile: AccountProfileSchema
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;
export type SittersQuery = z.infer<typeof SittersQuerySchema>;
