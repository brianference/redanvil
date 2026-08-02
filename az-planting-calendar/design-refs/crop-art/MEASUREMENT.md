# Crop art + layout options -- measured DoD

Scope: `az-planting-calendar/` only. No git commit/push, no deploy.
Layout options: mockups only (not implemented in the app).

## Crop list (queried)

Source: `npx wrangler d1 execute az-planting-calendar --local --command "SELECT id, name FROM crops ORDER BY name"`

Count: **45**

Ids (all covered with WebP):

crop-artichokes-globe, crop-artichokes-jerusalem, crop-asparagus, crop-beans-lima,
crop-beans-pinto, crop-beans-snap, crop-beans-yardlong, crop-beets, crop-blackeyed-peas,
crop-bok-choy, crop-carrots, crop-cauliflower, crop-celery, crop-chard, crop-collard-greens,
crop-corn-sweet, crop-cucumbers, crop-cucumbers-armenian, crop-eggplant, crop-endive,
crop-garlic, crop-kale, crop-leek, crop-lettuce-head, crop-lettuce-leaf,
crop-melons-watermelon, crop-mustard, crop-okra, crop-onions-bulb, crop-onions-shallots,
crop-parsnips, crop-peanuts, crop-peas, crop-peppers, crop-potatoes, crop-potatoes-sweet,
crop-pumpkin, crop-radishes, crop-rutabagas, crop-spinach, crop-squash-summer,
crop-squash-winter, crop-sunflower, crop-tomatoes, crop-turnips

Images generated: **45 / 45** (Grok Imagine `image_gen`).
Rejected / regenerated: **none** (every raw JPG opened and inspected -- see REVIEW.md).

## Optimisation

| Metric | Value |
|--------|-------|
| Output path | `public/crops/<crop-id>.webp` |
| Encode | sharp, 192×192, WebP q=78 |
| Total added weight | **81.4 KB** (83372 bytes) for all 45 |
| Largest single image | **crop-kale.webp** **4.2 KB** (4322 bytes) |
| Lazy-load | `loading="lazy"` for cards below first two; `decoding="async"`; width/height set |
| Fail closed | `CropArt` unmounts on `onError` -- no broken icon, no empty box |

### First-load transfer `/` (cold context, Resource Timing)

Date fixed `?date=2026-03-01` (plantable set). Measured after lazy priority fix.

| Viewport | Total KB | Without crop `/crops/` KB | Crop art KB | Crop requests |
|----------|----------|---------------------------|-------------|---------------|
| 375×844 | 757.2 | 721.2 | 36.0 | 19 |
| 1280×900 | 757.2 | 721.2 | 36.0 | 19 |

Before = total − crop art transfer (**721.2 KB**). After = **757.2 KB**. Delta = **+36.0 KB** plantable-set art (not the full 81.4 KB catalog). Remaining catalog assets load only when those crops appear.

Note: bulk of first-load image weight is pre-existing assets (hero-desert, brand-mark, og, etc.), not crop art.

Cold-visitor console: **clean** (`consoleErrors: []` on fresh contexts).

## Layout gallery (not implemented)

Path: `design-refs/home-options/gallery.html` (opened).
DECISION.md: structural differences written; chosen option blank.

12 frames on disk:

- option-1-{light,dark}-{375,1280}.png
- option-2-{light,dark}-{375,1280}.png
- option-3-{light,dark}-{375,1280}.png

## Commands (real tails)

- `npm run typecheck` -- exit 0
- `npm run lint` -- exit 0
- `npm test` -- 13 files, **87 passed**
- `npx playwright test` -- **52 passed** (14.0s)
- `npm run build` -- vite build OK (`index-CIhJXWBG.js`)

## Re-measured chrome (must not regress)

| Check | 375 | 1280 |
|-------|-----|------|
| Search y (filter-search) | **329.1** (in viewport) | **327.4** (in viewport) |
| Brand mark height | **56px** | **96px** (>= 48) |
| Visible truncated elements | **0** | **0** |

Visible truncation excludes intentional sr-only / 1px-clip labels (zone-selector__label, theme-toggle__sr-only, assistant__label).
