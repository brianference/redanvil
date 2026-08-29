import { describe, expect, it } from 'vitest';
import {
  availabilityOverlaps,
  parseMarketplaceState,
  serializeMarketplaceState
} from './searchState';

describe('parseMarketplaceState', () => {
  it('defaults to photos and empty filters', () => {
    const state = parseMarketplaceState(new URLSearchParams());
    expect(state.view).toBe('photos');
    expect(state.q).toBe('');
    expect(state.petType).toBe('');
  });

  it('reads known views and falls back on unknown ones', () => {
    expect(parseMarketplaceState(new URLSearchParams('view=map')).view).toBe('map');
    expect(parseMarketplaceState(new URLSearchParams('view=nope')).view).toBe('photos');
  });
});

describe('serializeMarketplaceState', () => {
  it('omits photos and empty filters', () => {
    const params = serializeMarketplaceState({
      view: 'photos',
      q: '  ',
      from: '',
      to: '',
      neighbourhood: '',
      petType: ''
    });
    expect(params.toString()).toBe('');
  });

  it('writes non-default view and trimmed query', () => {
    const params = serializeMarketplaceState({
      view: 'dates',
      q: ' Leslieville ',
      from: '2026-08-12',
      to: '2026-08-16',
      neighbourhood: 'Leslieville',
      petType: 'dogs'
    });
    expect(params.get('view')).toBe('dates');
    expect(params.get('q')).toBe('Leslieville');
    expect(params.get('pet_type')).toBe('dogs');
  });
});

describe('availabilityOverlaps', () => {
  it('treats an empty request range as a match', () => {
    expect(availabilityOverlaps('2026-08-01', '2026-08-31', '', '')).toBe(true);
  });

  it('rejects a stay entirely before or after the window', () => {
    expect(availabilityOverlaps('2026-08-10', '2026-08-20', '2026-08-01', '2026-08-05')).toBe(
      false
    );
    expect(availabilityOverlaps('2026-08-10', '2026-08-20', '2026-08-21', '2026-08-25')).toBe(
      false
    );
  });

  it('accepts an overlapping stay when bounds are missing', () => {
    expect(availabilityOverlaps(null, null, '2026-08-12', '2026-08-16')).toBe(true);
    expect(availabilityOverlaps('2026-08-01', '2026-08-31', '2026-08-12', '')).toBe(true);
  });
});
