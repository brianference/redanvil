-- Seed data from UA Cooperative Extension az1005 (Maricopa County).
-- Source URL: https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county
-- Author: Kai Umeda. Retrieved: 2026-08-01.
-- Every planting window is derived from the HTML table with TEXT month headers
-- (Jan. 1 … Dec. 15). Marks: S=seed, T=transplant, T/S=both, X=sets→S.
-- Do not invent windows. Re-run scripts/generate-seed.mjs after re-scraping.

INSERT OR REPLACE INTO sources (id, title, author, publisher, url, retrieved_at) VALUES (
  'src-az1005-maricopa',
  'Vegetable Planting Calendar for Maricopa County',
  'Kai Umeda',
  'University of Arizona Cooperative Extension',
  'https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county',
  '2026-08-01'
);

INSERT OR REPLACE INTO zones (id, name, zip, last_frost, first_frost) VALUES (
  'zone-cave-creek-85331',
  'Cave Creek AZ (low desert, Maricopa County)',
  '85331',
  '03-09',
  '11-15'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-artichokes-globe', 'Artichokes, Globe', NULL, NULL, '4-6 months'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-artichokes-jerusalem', 'Artichokes, Jerusalem', NULL, NULL, '6-8 months'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-asparagus', 'Asparagus', NULL, NULL, '2-3 years'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-basil', 'Basil', 60, 75, 'T = 30 S = 60-75 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-beans-lima', 'Beans, Lima', 60, 100, '60-100 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-beans-pinto', 'Beans, Pinto', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-beans-snap', 'Beans, Snap', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-beans-yardlong', 'Beans, Yardlong', 60, 90, '60-90days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-beets', 'Beets', 60, 80, '60-80 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-blackeyed-peas', 'Blackeyed Peas', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-bok-choy', 'Bok Choy', 45, 45, '45 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-broccoli', 'Broccoli', 120, 130, 'T=90-100 S=120-130 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-brussel-sprouts', 'Brussel Sprouts', 130, 150, 'T=100-120 S=130-150 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-cabbage', 'Cabbage', 120, 130, 'T=80-90 S=120-130 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-cabbage-chinese', 'Cabbage, Chinese', 70, 80, 'T=45 S=70-80 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-carrots', 'Carrots', 60, 100, '60-100 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-cauliflower', 'Cauliflower', 120, 130, 'T=90-100 S=120-130 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-celery', 'Celery', 120, 150, '120-150 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-chard', 'Chard', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-collard-greens', 'Collard Greens', 80, 80, '80 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-corn-sweet', 'Corn, Sweet', 70, 90, '70-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-cucumbers', 'Cucumbers', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-cucumbers-armenian', 'Cucumbers, Armenian', 55, 55, '55 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-eggplant', 'Eggplant', 70, 120, '70-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-endive', 'Endive', 80, 120, '80-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-garlic', 'Garlic', NULL, NULL, '5-7 months'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-kale', 'Kale', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-kohlrabi', 'Kohlrabi', 50, 60, 'T=45-60 S=50-60 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-lettuce-head', 'Lettuce, Head', 50, 100, '50-100 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-lettuce-leaf', 'Lettuce, Leaf', 30, 90, '30-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-leek', 'Leek', 180, 200, '180-200 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-melons-cantaloupe-honeydews-etc', 'Melons, Cantaloupe/Honeydews, etc.', 80, 120, '80-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-melons-watermelon', 'Melons, Watermelon', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-mustard', 'Mustard', 35, 45, '35-45 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-okra', 'Okra', 70, 100, '70-100 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-onions-bulb', 'Onions, Bulb', 4, 5, 'Sets=4-5 months S=7-8 months'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-onions-green', 'Onions, Green', 90, 100, 'T90-100 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-onions-shallots', 'Onions, Shallots', 80, 110, 'T80 - 110 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-parsnips', 'Parsnips', 100, 120, '100-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-peanuts', 'Peanuts', NULL, NULL, '5 months'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-peas', 'Peas', 120, 150, 'Sept.=60-120 Nov.=120-150 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-peppers', 'Peppers', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-potatoes', 'Potatoes', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-potatoes-sweet', 'Potatoes, Sweet', 120, 160, '120-160 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-pumpkin', 'Pumpkin', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-radishes', 'Radishes', 30, 60, '30-60 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-rutabagas', 'Rutabagas', 100, 120, '100-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-spinach', 'Spinach', 30, 90, '30-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-squash-summer', 'Squash, Summer', 60, 90, '60-90 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-squash-winter', 'Squash, Winter', 90, 120, '90-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-sunflower', 'Sunflower', 90, 110, '90-110 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-tomatoes', 'Tomatoes', 50, 120, '50-120 days'
);

INSERT OR REPLACE INTO crops (id, name, days_to_harvest_min, days_to_harvest_max, notes) VALUES (
  'crop-turnips', 'Turnips', 75, 120, '75-120 days'
);

INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-artichokes-globe-s-20-22', 'crop-artichokes-globe', 20, 22, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-artichokes-globe-t-1-5', 'crop-artichokes-globe', 1, 5, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-artichokes-jerusalem-t-1-9', 'crop-artichokes-jerusalem', 1, 9, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-asparagus-t-0-2', 'crop-asparagus', 0, 2, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-asparagus-t-20-23', 'crop-asparagus', 20, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-basil-s-3-9', 'crop-basil', 3, 9, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-basil-t-4-9', 'crop-basil', 4, 9, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-lima-s-5-6', 'crop-beans-lima', 5, 6, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-pinto-s-13-13', 'crop-beans-pinto', 13, 13, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-snap-s-5-7', 'crop-beans-snap', 5, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-snap-s-13-16', 'crop-beans-snap', 13, 16, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-yardlong-s-5-7', 'crop-beans-yardlong', 5, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beans-yardlong-s-9-12', 'crop-beans-yardlong', 9, 12, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beets-s-0-4', 'crop-beets', 0, 4, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-beets-s-17-23', 'crop-beets', 17, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-blackeyed-peas-s-6-15', 'crop-blackeyed-peas', 6, 15, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-bok-choy-s-0-3', 'crop-bok-choy', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-bok-choy-s-15-23', 'crop-bok-choy', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-broccoli-s-0-0', 'crop-broccoli', 0, 0, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-broccoli-s-15-23', 'crop-broccoli', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-broccoli-t-0-1', 'crop-broccoli', 0, 1, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-broccoli-t-17-23', 'crop-broccoli', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-brussel-sprouts-s-15-21', 'crop-brussel-sprouts', 15, 21, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-brussel-sprouts-t-16-21', 'crop-brussel-sprouts', 16, 21, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-s-0-0', 'crop-cabbage', 0, 0, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-s-15-23', 'crop-cabbage', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-t-0-1', 'crop-cabbage', 0, 1, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-t-17-23', 'crop-cabbage', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-chinese-s-0-0', 'crop-cabbage-chinese', 0, 0, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-chinese-s-15-23', 'crop-cabbage-chinese', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-chinese-t-0-1', 'crop-cabbage-chinese', 0, 1, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cabbage-chinese-t-17-23', 'crop-cabbage-chinese', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-carrots-s-0-7', 'crop-carrots', 0, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-carrots-s-14-23', 'crop-carrots', 14, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cauliflower-s-0-0', 'crop-cauliflower', 0, 0, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cauliflower-s-15-23', 'crop-cauliflower', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cauliflower-t-0-1', 'crop-cauliflower', 0, 1, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cauliflower-t-16-23', 'crop-cauliflower', 16, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-celery-s-15-23', 'crop-celery', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-celery-t-17-23', 'crop-celery', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-chard-s-0-1', 'crop-chard', 0, 1, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-chard-s-15-23', 'crop-chard', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-chard-t-0-1', 'crop-chard', 0, 1, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-chard-t-17-23', 'crop-chard', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-collard-greens-s-0-3', 'crop-collard-greens', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-collard-greens-s-15-15', 'crop-collard-greens', 15, 15, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-collard-greens-s-17-23', 'crop-collard-greens', 17, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-corn-sweet-s-3-6', 'crop-corn-sweet', 3, 6, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-corn-sweet-s-13-15', 'crop-corn-sweet', 13, 15, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cucumbers-s-3-7', 'crop-cucumbers', 3, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cucumbers-s-15-17', 'crop-cucumbers', 15, 17, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-cucumbers-armenian-s-3-12', 'crop-cucumbers-armenian', 3, 12, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-eggplant-t-4-5', 'crop-eggplant', 4, 5, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-endive-s-0-1', 'crop-endive', 0, 1, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-endive-s-16-23', 'crop-endive', 16, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-garlic-s-18-19', 'crop-garlic', 18, 19, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-kale-s-15-23', 'crop-kale', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-kohlrabi-s-15-21', 'crop-kohlrabi', 15, 21, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-kohlrabi-t-0-2', 'crop-kohlrabi', 0, 2, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-kohlrabi-t-19-23', 'crop-kohlrabi', 19, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-head-s-0-1', 'crop-lettuce-head', 0, 1, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-head-s-15-23', 'crop-lettuce-head', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-head-t-0-2', 'crop-lettuce-head', 0, 2, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-head-t-17-23', 'crop-lettuce-head', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-leaf-s-0-2', 'crop-lettuce-leaf', 0, 2, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-leaf-s-15-23', 'crop-lettuce-leaf', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-leaf-t-0-3', 'crop-lettuce-leaf', 0, 3, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-lettuce-leaf-t-17-23', 'crop-lettuce-leaf', 17, 23, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-leek-s-0-1', 'crop-leek', 0, 1, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-leek-s-15-18', 'crop-leek', 15, 18, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-melons-cantaloupe-honeydews-etc-s-3-12', 'crop-melons-cantaloupe-honeydews-etc', 3, 12, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-melons-watermelon-s-3-5', 'crop-melons-watermelon', 3, 5, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-mustard-s-0-3', 'crop-mustard', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-mustard-s-15-23', 'crop-mustard', 15, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-okra-s-3-7', 'crop-okra', 3, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-onions-bulb-s-0-2', 'crop-onions-bulb', 0, 2, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-onions-bulb-s-18-23', 'crop-onions-bulb', 18, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-onions-green-s-0-7', 'crop-onions-green', 0, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-onions-green-s-14-23', 'crop-onions-green', 14, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-onions-shallots-s-12-13', 'crop-onions-shallots', 12, 13, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-parsnips-s-16-21', 'crop-parsnips', 16, 21, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-peanuts-s-5-7', 'crop-peanuts', 5, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-peas-s-0-3', 'crop-peas', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-peas-s-17-22', 'crop-peas', 17, 22, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-peppers-t-3-5', 'crop-peppers', 3, 5, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-peppers-t-12-13', 'crop-peppers', 12, 13, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-potatoes-s-0-4', 'crop-potatoes', 0, 4, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-potatoes-sweet-t-4-11', 'crop-potatoes-sweet', 4, 11, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-pumpkin-s-4-5', 'crop-pumpkin', 4, 5, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-pumpkin-s-12-14', 'crop-pumpkin', 12, 14, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-radishes-s-0-7', 'crop-radishes', 0, 7, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-radishes-s-16-23', 'crop-radishes', 16, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-rutabagas-s-0-1', 'crop-rutabagas', 0, 1, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-rutabagas-s-16-23', 'crop-rutabagas', 16, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-spinach-s-0-3', 'crop-spinach', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-spinach-s-16-23', 'crop-spinach', 16, 23, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-squash-summer-s-3-6', 'crop-squash-summer', 3, 6, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-squash-summer-s-15-16', 'crop-squash-summer', 15, 16, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-squash-winter-s-4-5', 'crop-squash-winter', 4, 5, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-squash-winter-s-12-14', 'crop-squash-winter', 12, 14, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-sunflower-s-2-13', 'crop-sunflower', 2, 13, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-tomatoes-t-3-5', 'crop-tomatoes', 3, 5, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-tomatoes-t-13-14', 'crop-tomatoes', 13, 14, 'T', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-turnips-s-0-3', 'crop-turnips', 0, 3, 'S', 'src-az1005-maricopa');
INSERT OR REPLACE INTO planting_windows (id, crop_id, start_half_month, end_half_month, method, source_id) VALUES ('pw-crop-turnips-s-15-23', 'crop-turnips', 15, 23, 'S', 'src-az1005-maricopa');

-- Summary: 53 crops, 105 planting windows.
