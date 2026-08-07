# Avatar sources — Pet Sitter Finder

All eight sitter portraits were generated with Grok Imagine (`image_gen`) on **2026-08-05**.
They are synthetic character portraits, not photographs of real people, and are not licensed stock.

| File | Seed sitter | Prompt used |
|------|-------------|-------------|
| `avery-chen.jpg` | Avery Chen | Friendly synthetic portrait photo of a young East Asian woman in her late 20s, short dark bob haircut, warm genuine smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic but clearly illustrated as a friendly stock-style character portrait, not a celebrity. Square composition. |
| `jordan-patel.jpg` | Jordan Patel | Friendly synthetic portrait photo of a South Asian man in his early 30s, short neat black hair, kind smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar, not a real celebrity. Square composition. |
| `sam-okonkwo.jpg` | Sam Okonkwo | Friendly synthetic portrait photo of a Black man in his early 30s with short hair and a warm open smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |
| `riley-ng.jpg` | Riley Ng | Friendly synthetic portrait photo of a young East Asian woman in her late 20s with long dark hair and a friendly soft smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |
| `morgan-ellis.jpg` | Morgan Ellis | Friendly synthetic portrait photo of a non-binary-presenting person in their late 20s with medium-length wavy brown hair, freckles, warm smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |
| `casey-brooks.jpg` | Casey Brooks | Friendly synthetic portrait photo of a Caucasian woman in her early 30s with light brown hair in a casual ponytail, bright outdoor-friendly smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |
| `taylor-kim.jpg` | Taylor Kim | Friendly synthetic portrait photo of a young East Asian man in his late 20s with short black hair and round glasses, soft gentle smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |
| `alex-rivera.jpg` | Alex Rivera | Friendly synthetic portrait photo of a Latino man in his early 30s with short dark hair and light stubble, confident warm smile, soft natural daylight, neutral cream background, head and shoulders, looking at camera, photorealistic friendly character portrait for an app avatar. Square composition. |

**Tool:** Grok Build `image_gen` (Grok Imagine), aspect ratio `1:1`.  
**Replacement policy:** These files replace any prior unprovenanced JPGs in this folder. Do not ship unlabeled real-person photographs as named sitters.

**Delivery size:** Originals were 1024×1024 (~200KB each). They are re-encoded in
place to **176×176 JPEG** (quality ~82) so mobile payloads stay light while
provenance (same generated portraits, not regenerated) holds. UI renders them
at roughly 56–88 CSS px.

