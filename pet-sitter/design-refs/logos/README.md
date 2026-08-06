# Brand mark — pet-sitter

A **real generated brand mark** is required before this app can pass the gate.

- Use Grok Imagine / the brand-logo skill (not an emoji, not text initials in a span).
- Put production assets under `public/` (logo-mark, favicon, OG) and reference them from the shell.
- Text-only marks (e.g. a span with "AZ") fail `fe-brand-mark`.
- Favicon/OG stubs under a few KB fail `fe-brand-mark`.

Store candidate marks in this directory during design; ship the chosen mark to `public/`.
