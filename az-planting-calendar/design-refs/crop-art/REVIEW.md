# Crop art review log

Source: D1 `SELECT id, name FROM crops` -- 45 rows.
Style target: flat produce icons, warm sand background, no text, no photoreal, no 3D bevels.
Generator: Grok Imagine (`image_gen`), then sharp -> 192px WebP in `public/crops/<crop-id>.webp`.

## Accepted after visual review (45)

Every raw JPG in `design-refs/crop-art/raw/` was opened and inspected.

| id | verdict | notes |
|----|---------|-------|
| crop-artichokes-globe | accept | clear globe artichoke, flat, sand bg |
| crop-artichokes-jerusalem | accept | knobby sunchoke tuber + leaves |
| crop-asparagus | accept | tied spear bunch, flat |
| crop-beans-lima | accept | open pale pods with beans |
| crop-beans-pinto | accept | speckled beans + open pod |
| crop-beans-snap | accept | green snap pods cluster |
| crop-beans-yardlong | accept | long dark beans, reads as yardlong |
| crop-beets | accept | purple root + greens |
| crop-blackeyed-peas | accept | open pod, black eyes clear |
| crop-bok-choy | accept | white stems, dark leaves |
| crop-carrots | accept | orange bunch with tops |
| crop-cauliflower | accept | white head + leaves |
| crop-celery | accept | stalk bunch |
| crop-chard | accept | rainbow stems (minor white outline sticker -- still shippable) |
| crop-collard-greens | accept | broad dark leaves |
| crop-corn-sweet | accept | husked ear (rounded card plate -- minor frame, subject clear) |
| crop-cucumbers | accept | classic green cucumber |
| crop-cucumbers-armenian | accept | pale ribbed long form |
| crop-eggplant | accept | purple with calyx (soft highlight only) |
| crop-endive | accept | frilly pale head top-down |
| crop-garlic | accept | bulb + cloves |
| crop-kale | accept | curly dark leaves |
| crop-lettuce-head | accept | closed pale head |
| crop-lettuce-leaf | accept | red-tipped loose leaf |
| crop-leek | accept | white stalk + green fan |
| crop-melons-watermelon | accept | striped whole melon |
| crop-mustard | accept | greens + yellow flowers |
| crop-okra | accept | ridged green pods |
| crop-onions-bulb | accept | brown bulb (slightly glossy but not 3D plastic) |
| crop-onions-shallots | accept | clustered copper bulbs |
| crop-parsnips | accept | cream tapered roots |
| crop-peanuts | accept | shells + open nuts |
| crop-peas | accept | open pods with peas |
| crop-peppers | accept | red bell + green chile |
| crop-potatoes | accept | russet pair |
| crop-potatoes-sweet | accept | elongated orange tuber |
| crop-pumpkin | accept | ribbed orange |
| crop-radishes | accept | red/white bunch |
| crop-rutabagas | accept | purple-top yellow root |
| crop-spinach | accept | leaf pile |
| crop-squash-summer | accept | yellow crookneck |
| crop-squash-winter | accept | butternut shape |
| crop-sunflower | accept | yellow flower (rounded plate frame -- minor) |
| crop-tomatoes | accept | red tomato + calyx |
| crop-turnips | accept | purple/white roots |

## Rejected / regenerated

**None.** First-pass outputs all met the style bar (flat illustration, sand plate, no baked text, subject readable). Rate-limit 429s on an early 10-way parallel burst delayed generation; later batches of 3 succeeded without content rejects.

## Coverage

- Generated: **45 / 45**
- Missing (fail-closed text card): **none**
