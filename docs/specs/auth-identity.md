# Spec: an explicit sign-in answer is discarded by a positional feature id

## Defect 1 -- auth identity is `id === 'F3' && name === 'Accounts'` [VERIFIED: app-builder/src/lib/prd/sections/features.ts:418-426, read 2026-08-22]

`app-builder/src/lib/prd/sections/features.ts:418`:

```ts
export function authRequiredByFeatures(wizardHasAuth, selectedFeatures) {
  if (!wizardHasAuth) return false;
  return selectedFeatures.some((f) => f.id === 'F3' && f.name === 'Accounts');
}
```

and `app-builder/src/lib/prd/generate.ts:176`:

```ts
const hasAuth = selectionActive ? authRequiredByFeatures(wizardHasAuth, features) : wizardHasAuth;
```

**Measured tonight, on a real run against production.** The wizard was answered
`Does this app need sign-in?: Yes` -- confirmed by reading `aria-pressed` back
off the live control, recorded in `docs/prd-provenance.json`. The generated PRD
front matter still said:

```yaml
hasAuth: false
```

and section 3 of that document reads, verbatim:

> The product is fully public — no register/login, no session middleware, no user-owned scoping [VERIFIED: job-application-site/docs/PRD.md:72, read 2026-08-22].

against a prompt whose text is "Accounts are needed, since the tracked
applications are personal."

The reason is in the generated feature list of that same document:

```
### F8 — Accounts **[MVP]**
```

The feature IS present and IS named `Accounts`. It is **F8**, because eleven
capability-derived features are numbered ahead of it. `F3` is
`Ones They Sent grid`. The `some()` therefore returns false and an explicit
answer is thrown away in silence.

A positional id is not an identity. The number depends on how many
capability-derived features happen to precede it, which depends on the prompt,
so this check passes or fails based on prose the user wrote about something
else. Requiring the literal name as well does not save it -- it makes the check
strictly harder to satisfy, not safer.

**Required:** identify the accounts feature by a stable property, not by
position. A `FeatureSpec` field that says what the feature IS (a kind/role
discriminant set where the feature is constructed) is the fix; matching on
`name` alone is the same class of defect one step weaker. Whatever you choose,
it must survive the feature being renumbered.

**Required, and separate:** silently downgrading an explicit answer is wrong
even when the derivation is right. If `wizardHasAuth` is true and no accounts feature is selected, that is a contradiction the document must not paper over [VERIFIED: measured 2026-08-22, provenance recorded Yes while front matter said false].
Either way --
keep the user's answer, or state in the PRD that auth was dropped and why. [VERIFIED: generate.ts:176, read 2026-08-22] Do not let the front matter assert `hasAuth: false` while the recorded
provenance says the user answered Yes. Pick the behaviour you can defend and
write down which you picked.

## Defect 2 -- features and entities are built from pronoun phrases

The same document contains:

```
### F1 — Search ones they sent
### F3 — Ones They Sent grid
### F5 — Ones They Sent detail
```

`ones they sent` is lifted from "loses track of which **ones they sent**". It is
a pronoun phrase, not a domain noun, and it is now a feature name and an entity
label in a shipped requirements document.

This is the SAME family as the recorded bugs #8 (`App to Remind You When Your`)
and #10 (`entities: ["Cleaned"]`), both of which are phrase-shape heuristics
matching the wrong part of speech. #10 is recorded NOT fixed.

**Required:** a phrase whose head is a pronoun (`ones`, `one`, `those`, `them`,
`it`, `they`, `which`) is not a domain entity or a feature subject. Reject it in
the derivation. If a prompt yields no usable entity after that rejection, the
existing `UnresolvedPrdError` path already exists for exactly that case
(`generate.ts:151`) -- use it rather than emitting a pronoun.

Do NOT special-case the literal string "ones they sent". That fixes one prompt.

## Tests -- each must be shown FAILING first

1. `authRequiredByFeatures` returns true when the accounts feature is present at a NON-F3 id [VERIFIED: `F8 - Accounts` at job-application-site/docs/PRD.md:447].
2. It still returns false when `wizardHasAuth` is false, whatever is selected.
3. A full generate on the real prompt at
   `.redanvil/overnight/concept-job-application-site.txt` does NOT produce
   `hasAuth: false` together with a provenance answer of Yes, and does NOT emit
   the "fully public — no register/login" sentence.
4. No derived entity or feature name has a pronoun head.
5. A negative control: a genuinely public app prompt with sign-in answered No
   still produces `hasAuth: false`.

For each, produce the input that makes it fail and read the real exit code.

## Constraints

- Regenerate characterization digests with the REAL generator if they move, and
  justify every digest that moved. Never hand-edit one to make a test pass -- a
  golden freezes a bug with exactly the authority it freezes a feature.
- Do not commit, stage, push, deploy, or run any git command.
- TypeScript strict. JSDoc on every function. No new dependencies.
- Read every file before editing it.
