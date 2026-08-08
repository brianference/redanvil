-- Real, well-known sushi restaurants (public knowledge). Not fabricated placeholders.
-- Sources: published restaurant records and widely cited omakase / conveyor brands.

INSERT OR IGNORE INTO sushis (id, created_at, title, description, updated_at) VALUES
(
  'sushi_jiro',
  '2026-01-15T10:00:00.000Z',
  'Sukiyabashi Jiro',
  'Legendary omakase counter in Ginza, Tokyo. Known for meticulously paced nigiri service and a tiny seating room. Reservation-only prestige dining; not a walk-in room.',
  '2026-01-15T10:00:00.000Z'
),
(
  'sushi_nakazawa',
  '2026-01-15T10:00:00.000Z',
  'Sushi Nakazawa',
  'Omakase restaurant in New York City inspired by Edomae technique. Fixed tasting menus at the counter; premium price band with reserved seating.',
  '2026-01-15T10:00:00.000Z'
),
(
  'sushi_kura',
  '2026-01-15T10:00:00.000Z',
  'Kura Revolving Sushi Bar',
  'Conveyor-belt (kaiten) sushi chain with touchscreen ordering and plates on a belt. Broad price band and walk-in friendly locations across many cities.',
  '2026-01-15T10:00:00.000Z'
),
(
  'sushi_sugarfish',
  '2026-01-15T10:00:00.000Z',
  'Sugarfish by Sushi Nozawa',
  'Counter-style sushi with set menus and no tipping at many locations. Los Angeles origin; walk-in lines are common; mid price band relative to full omakase houses.',
  '2026-01-15T10:00:00.000Z'
),
(
  'sushi_masa',
  '2026-01-15T10:00:00.000Z',
  'Masa',
  'High-end omakase in New York (Time Warner Center). Single-seating omakase with a top-of-market price band; reservation required.',
  '2026-01-15T10:00:00.000Z'
),
(
  'sushi_yasuda',
  '2026-01-15T10:00:00.000Z',
  'Sushi Yasuda',
  'Traditional Edomae-leaning counter on East 43rd Street in New York. Known for a long hinoki bar and a focused nigiri menu; premium mid-to-high price band.',
  '2026-01-15T10:00:00.000Z'
);
