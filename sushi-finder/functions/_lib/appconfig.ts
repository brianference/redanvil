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
  name: 'Sushi Finder',
  // Unique per app: a shared cookie name under *.pages.dev would let one app
  // receive another app's session.
  cookieName: 'sushi_session',
  brandColor: '#0f766e',
  textColor: '#16122b',
  mutedColor: '#5b5878',
  accountPurpose:
    'You received this because you keep a list of sushi places on Sushi Finder. Every place links to its own listing; we never invent restaurants.',
}
