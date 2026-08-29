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
  name: 'Arizona Planting Calendar',
  // Unique per app: a shared cookie name under *.pages.dev would let one app
  // receive another app's session.
  cookieName: 'azcal_session',
  brandColor: '#0a6b42',
  textColor: '#141a21',
  mutedColor: '#2c3844',
  accountPurpose:
    'You received this because you keep a garden bed on the Arizona Planting Calendar. Planting windows come from USDA zone data for your area.',
}
