# Logo brief template (Grok Imagine)

Copy this, fill the bracketed parts, send it. It exists because a hand-written
brief once banned gradients, dimensional shading, drop shadows and the category's
own visual convention, then asked for something "premium" — and got flat line art.
The tool was never the ceiling. See mobile-design-rules R25.

## The two rules that produce quality

1. **Ban only what is disqualifying.** "Must read at 32px", "no real brand marks",
   "no text" are requirements. "No gradients", "no swoosh", "flat only" are your
   taste, and encoding taste as a ban removes whole categories from the option set
   without the user ever seeing them (R24).
2. **Adjectives lose to constraints.** "Premium" beside "flat, one colour, no
   gradient, no shadow" resolves to flat, every time. Read the brief back and check
   its constraints against its own adjective before sending.

---

## Template

> Use your Grok Imagine `image_gen` tool to generate logo marks for **[NAME]**,
> a [one line on what the product does and who it is for].
>
> Tone: [precise / warm / premium / playful — pick two at most].
>
> ### What good looks like
>
> Professional [category] marks with real craft. **Gradients, tapered variable-width
> strokes, dimensional shading and a soft ground shadow are all welcome** — the goal
> is a mark that looks designed, not a wireframe. Balanced composition, optically
> centred, generous negative space.
>
> If [category] has a visual convention — [name it: the orbit for travel, the leaf
> for eco, the chat bubble for messaging] — **execute it well rather than avoiding
> it.** It is a convention because it reads instantly.
>
> ### Generate FOUR distinct directions, 1024x1024
>
> ```
> logos/v1-01.png   [direction 1 — e.g. tapered ribbon, deep-to-bright gradient in one hue]
> logos/v1-02.png   [direction 2 — e.g. dimensional / metallic with specular highlights]
> logos/v1-03.png   [direction 3 — e.g. bold solid form, strong silhouette]
> logos/v1-04.png   [direction 4 — e.g. duotone geometric, overlapping forms]
> ```
>
> A clean neutral background is fine — craft matters more than transparency here.
>
> ### Plus a flat companion of the strongest idea
>
> ```
> logos/v1-flat.png   1024x1024, transparent, single flat colour, heavier even stroke
> ```
>
> This is the working asset: it survives 32x32 and recolours for a dark UI. The rich
> version is for the header and marketing. Both must clearly be the same mark.
>
> ### Off limits
>
> - No text, letters, numbers or wordmarks [unless a deliberate monogram is wanted].
> - No real company logos, liveries or trademarked iconography.
> - No people, no faces, no photographic imagery.
> - No muddy edges or JPEG artefacts.
>
> Reply with the file paths.

---

## After generation — always

- **Look at every one** (Read renders the PNG). Say plainly which are bad and why.
  Two of five and five of sixteen icons were unusable in one real run; marking them
  is part of the deliverable, not a failure to hide.
- **Reject product renders.** A 3D object with a photographic light setup is not a
  logo: it will not flatten, recolour, or work small.
- **Composite the shortlist on the real light AND dark backgrounds**, and at 32px,
  before recommending one. Approved-at-1024 says nothing about 32.
- **Show the user mockups of the actual product wearing each finalist**, with the
  palette re-derived from that mark, and let them pick (R24).

## Preparing the winner

A render on a light field is not a UI asset. To key it:

- Flood from the borders to remove the background, **then** remove enclosed pale
  regions by connected-component size — interiors and ground shadows are large
  components; a specular highlight on the mark is a thin one, and a naive
  "remove all pale pixels" cuts it out.
- Verify by compositing on both theme backgrounds and looking. A mark that leaves
  white blobs on dark has not been keyed, whatever the alpha channel says.
- Emit two assets: the trimmed full-colour mark, and a padded square icon source
  (R10.7 — the favicon derives from the SAME mark).
