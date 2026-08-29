/**
 * The only file that changes when this kit is ported to a new app.
 *
 * Everything else in `_lib/` and `api/auth/` is byte-identical across apps, so a
 * fix made once can be copied everywhere without re-reading the diff. If you find
 * yourself editing another file to accommodate one app, add a field here instead.
 */

export type AppConfig = {
  /** Human-readable product name. Appears in email subjects, bodies and the sender name. */
  name: string
  /**
   * Session cookie name. Must be unique per app: several of these deploy to
   * *.pages.dev, and a shared cookie name on a shared parent domain would let one
   * app's session cookie be sent to another.
   */
  cookieName: string
  /** Primary brand colour, used for email buttons and headings. */
  brandColor: string
  /** Body text colour for email templates. */
  textColor: string
  /** Muted text colour for email footnotes. */
  mutedColor: string
  /**
   * One sentence naming what an account actually holds. Shown in the email
   * footer so a recipient can tell why they got the message. Write it per app —
   * "You received this because you use X" with nothing specific is the kind of
   * filler that gets a sender marked as spam.
   */
  accountPurpose: string
  /**
   * Tenancy scope. Set this ONLY when the app shares its D1 database with other
   * apps (see migrations/0001_auth_core_shared.sql). When set, every lookup by
   * email is additionally filtered by `users.app = scope`, and new rows are
   * stamped with it.
   *
   * Leave it undefined for an app with its own database. The queries then behave
   * exactly as they did before this field existed, so the apps already in
   * production are unaffected and need no migration.
   */
  scope?: string
}

export const APP: AppConfig = {
  name: 'CHANGE ME',
  cookieName: 'changeme_session',
  brandColor: '#c45c26',
  textColor: '#2a1c14',
  mutedColor: '#8a7365',
  accountPurpose: 'CHANGE ME',
}
