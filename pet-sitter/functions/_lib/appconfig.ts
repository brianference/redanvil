/**
 * The only file that changes when the auth kit is ported to a new app.
 * See RedAnvil/design-system/auth-kit/README.md.
 */
export type AppConfig = {
  name: string
  cookieName: string
  brandColor: string
  textColor: string
  mutedColor: string
  accountPurpose: string
}

export const APP: AppConfig = {
  name: 'Pet Sitter',
  // Unique per app: a shared cookie name under *.pages.dev would let one app
  // receive another app's session.
  cookieName: 'petsitter_session',
  brandColor: '#46318a',
  textColor: '#0e0c16',
  mutedColor: '#6b7280',
  accountPurpose:
    'You received this because you have a Pet Sitter account. Every sitter links to their own profile; we never invent sitters.',
}
