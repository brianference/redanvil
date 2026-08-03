// Plain TS (no JSX) so this fixture typechecks standalone under a Node-only
// tsconfig with no React/JSX setup; u-legal-claims-true scans raw file text
// for the disclosure pattern below, it never compiles this file.
export const PRIVACY_COPY = 'We do not use cookies on this site.';

export default function Privacy(): string {
  return PRIVACY_COPY;
}
