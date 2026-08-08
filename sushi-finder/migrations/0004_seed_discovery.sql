-- Real places: public coordinates and style labels from widely published records.
-- Photos are local assets (design-refs/palettes/food) — not live third-party streams.
-- walk_in is a static catalog attribute, not live seating inventory (FEATURES B3).

UPDATE sushis SET
  style = 'omakase',
  price_band = '$$$$',
  walk_in = 0,
  city = 'Tokyo',
  lat = 35.6717,
  lng = 139.7643,
  photo_url = '/food-omakase.jpg'
WHERE id = 'sushi_jiro';

UPDATE sushis SET
  style = 'omakase',
  price_band = '$$$$',
  walk_in = 0,
  city = 'New York',
  lat = 40.7319,
  lng = -74.0032,
  photo_url = '/food-omakase.jpg'
WHERE id = 'sushi_nakazawa';

UPDATE sushis SET
  style = 'conveyor',
  price_band = '$$',
  walk_in = 1,
  city = 'Los Angeles',
  lat = 34.0522,
  lng = -118.2437,
  photo_url = '/food-conveyor.jpg'
WHERE id = 'sushi_kura';

UPDATE sushis SET
  style = 'counter',
  price_band = '$$$',
  walk_in = 1,
  city = 'Los Angeles',
  lat = 34.0407,
  lng = -118.2468,
  photo_url = '/food-counter.jpg'
WHERE id = 'sushi_sugarfish';

UPDATE sushis SET
  style = 'omakase',
  price_band = '$$$$',
  walk_in = 0,
  city = 'New York',
  lat = 40.7681,
  lng = -73.9819,
  photo_url = '/food-modern.jpg'
WHERE id = 'sushi_masa';

UPDATE sushis SET
  style = 'counter',
  price_band = '$$$',
  walk_in = 0,
  city = 'New York',
  lat = 40.7516,
  lng = -73.9755,
  photo_url = '/food-counter.jpg'
WHERE id = 'sushi_yasuda';
