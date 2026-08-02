-- Per-crop growing guidance (how to plant): depth, spacing, sun, water, harvest note.
-- Only rows backed by a University of Arizona Cooperative Extension publication.
-- A crop with no row here gets no invented guidance in the API or UI.
-- Planting WINDOWS remain az1005-only; these sources supply cultivation HOW figures.
-- Each guide row cites ONE source; every non-null field on that row comes from that source.
-- Retrieval date: 2026-08-02. Every URL was HTTP 200 with a browser user-agent.

CREATE TABLE IF NOT EXISTS crop_guides (
  crop_id TEXT PRIMARY KEY REFERENCES crops(id),
  depth TEXT,
  spacing_in_row TEXT,
  spacing_between_rows TEXT,
  sun TEXT,
  water TEXT,
  harvest_note TEXT,
  source_id TEXT NOT NULL REFERENCES sources(id)
);

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-az1615-yuma',
  'Planting and Harvesting Calendar for Gardeners in Yuma County (az1615, reviewed March 2020) — depth, row width, and plant spacing only; not used for Maricopa planting windows',
  'Stacey R. Bealmear and Kurt D. Nolte; reviewed by Robert Masson and Janine Lane',
  'University of Arizona Cooperative Extension',
  'https://extension.arizona.edu/sites/default/files/2024-08/az1615-2020.pdf',
  '2026-08-02'
);

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-tomato-ua',
  'Tomato Planting, Growing and Harvest (publication date February 2019)',
  'University of Arizona Cooperative Extension',
  'University of Arizona Cooperative Extension',
  'https://extension.arizona.edu/publication/tomato-planting-growing-and-harvest',
  '2026-08-02'
);

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-asparagus-byg153',
  'Asparagus (BYG153, publication date February 2024)',
  'Jeff Schalau',
  'University of Arizona Cooperative Extension',
  'https://extension.arizona.edu/publication/asparagus',
  '2026-08-02'
);

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-byg74-vegetables',
  'Vegetable Crops “A to Z” (Backyard Gardener #74)',
  'Jeff Schalau (adapted from original Backyard Gardener publications)',
  'University of Arizona Cooperative Extension, Yavapai County',
  'https://extension.arizona.edu/sites/default/files/attachment/Vegetables.pdf',
  '2026-08-02'
);

-- az1615 veggies table (pdftotext -raw, 2026-08-02):
-- Planting Depth (in) | Row Width (in) | Plant Spacing (in)
-- sun/water/harvest_note left NULL: that publication does not state them per crop in the table.

INSERT OR REPLACE INTO crop_guides (crop_id, depth, spacing_in_row, spacing_between_rows, sun, water, harvest_note, source_id) VALUES
  ('crop-artichokes-globe', '1 to 2 in', '24 in', '32 to 40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-beans-pinto', '1 in', '6 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-beans-snap', '1/2 to 1 in', '3 to 4 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-beans-lima', '1 in', '6 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-beans-yardlong', '1/2 to 1 in', '3 to 4 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-beets', '1 in', '4 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-blackeyed-peas', '2 in', '4 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-bok-choy', '1/4 in', '10 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-carrots', '1/8 in', '1 to 2 in', '20 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-cauliflower', '3 in', '10 to 12 in', '36 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-celery', '3 in (transplant)', '10 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-chard', '1/8 in', '10 to 12 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-corn-sweet', '2 in', '10 in', '30 to 40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-cucumbers', '1 in', '6 to 10 in', '5 to 6 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-cucumbers-armenian', '1 in', '6 to 10 in', '5 to 6 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-eggplant', '1/2 in', '10 in', '30 to 40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-garlic', '1 to 2 in', '3 in', '12 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-kale', '1/4 in', '6 to 10 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-leek', '3 in (transplants)', '6 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-lettuce-head', '1/8 in', '10 to 12 in', '18 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-lettuce-leaf', '1/8 in', '10 to 12 in', '18 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-melons-watermelon', '1 to 2 in', '6 to 10 in', '8 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-okra', '1 in', '12 to 18 in', '30 to 40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-onions-bulb', '1/2 in', '4 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-peanuts', '1 to 2 in', '8 to 10 in', '40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-peas', '1 in', '4 in', '15 to 18 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-peppers', '1/2 in', '6 to 10 in', '36 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-potatoes', '6 in', '12 in', '30 to 40 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-pumpkin', '1 in', '12 in', '40 to 48 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-radishes', '1/2 in', '1 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-squash-summer', '1 in', '12 in', '40 to 48 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-squash-winter', '1 in', '12 in', '40 to 48 in', NULL, NULL, NULL, 'src-az1615-yuma'),
  ('crop-turnips', '1/4 in', '6 in', '30 in', NULL, NULL, NULL, 'src-az1615-yuma');

-- Spinach: spacing/sun/water from Vegetable Crops A to Z (BYG #74) only.
INSERT OR REPLACE INTO crop_guides (crop_id, depth, spacing_in_row, spacing_between_rows, sun, water, harvest_note, source_id) VALUES (
  'crop-spinach',
  NULL,
  'Thin plants to 3 in within each row',
  'Plant in rows 12 in apart',
  'Sunny locations; fertile, well-drained soil',
  '1 to 2 inches per week, depending on temperatures',
  'Tastes best when it matures before summer heat.',
  'src-byg74-vegetables'
);

-- Sweet potatoes: slips spacing from Vegetable Crops A to Z only.
INSERT OR REPLACE INTO crop_guides (crop_id, depth, spacing_in_row, spacing_between_rows, sun, water, harvest_note, source_id) VALUES (
  'crop-potatoes-sweet',
  NULL,
  '12 in within the row',
  '36 to 48 in between rows',
  NULL,
  NULL,
  'Grown from slips (stem cuttings); plant after the danger of frost is over.',
  'src-byg74-vegetables'
);

-- Asparagus: BYG153 (Jeff Schalau).
INSERT OR REPLACE INTO crop_guides (crop_id, depth, spacing_in_row, spacing_between_rows, sun, water, harvest_note, source_id) VALUES (
  'crop-asparagus',
  'Dig a 10 to 12 in hole; cover crowns with loose soil and backfill as plants grow',
  '1 ft between crowns',
  '4 to 5 ft between rows',
  'Full sun; plant on the north or east side of the garden to avoid shading lower crops',
  'Keep well irrigated, especially the first year while crowns establish',
  'Do not harvest during the first year; allow plants to store energy in the crowns for the following year',
  'src-asparagus-byg153'
);

-- Tomatoes: dedicated UA Extension page (not az1615 table).
INSERT OR REPLACE INTO crop_guides (crop_id, depth, spacing_in_row, spacing_between_rows, sun, water, harvest_note, source_id) VALUES (
  'crop-tomatoes',
  'Plant the transplant slightly deeper than it had been growing in the container; tall transplants can be laid sideways in a trench so roots form along the buried stem',
  'At least 24 in between individual plants',
  NULL,
  NULL,
  'Water tomato plants slowly and deeply at planting. In containers, keep moisture even rather than cycling from very wet to very dry.',
  NULL,
  'src-tomato-ua'
);

-- Crops without a guide row this session (no confident per-crop Extension transcription):
-- crop-artichokes-jerusalem, crop-collard-greens, crop-endive, crop-mustard,
-- crop-onions-shallots, crop-parsnips, crop-rutabagas, crop-sunflower.
