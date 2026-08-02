import { describe, expect, it } from 'vitest';
import {
  isStateQuery,
  matchOutOfCoveragePlace
} from './coverage';
import { filterZones } from '../components/ZoneSelector';
import type { Zone } from './schemas';

const sampleZones: Zone[] = [
  {
    id: 'zone-phoenix-85004',
    name: 'Phoenix AZ (low desert, Maricopa County)',
    zip: '85004',
    last_frost: '02-03',
    first_frost: '12-08',
    county: 'Maricopa',
    elevation_ft: 1154
  },
  {
    id: 'zone-scottsdale-85251',
    name: 'Scottsdale AZ (low desert, Maricopa County)',
    zip: '85251',
    last_frost: '02-24',
    first_frost: '11-29',
    county: 'Maricopa',
    elevation_ft: 1167
  }
];

describe('matchOutOfCoveragePlace', () => {
  it('names known out-of-coverage Arizona places', () => {
    expect(matchOutOfCoveragePlace('Sierra Vista')).toBe('Sierra Vista');
    expect(matchOutOfCoveragePlace('tucson')).toBe('Tucson');
    expect(matchOutOfCoveragePlace('Pinetop')).toBe('Pinetop');
    expect(matchOutOfCoveragePlace('flagstaff az')).toBe('Flagstaff');
  });

  it('returns null for covered towns and nonsense', () => {
    expect(matchOutOfCoveragePlace('Phoenix')).toBeNull();
    expect(matchOutOfCoveragePlace('zzznomatch')).toBeNull();
  });
});

describe('isStateQuery', () => {
  it('recognizes AZ and Arizona', () => {
    expect(isStateQuery('AZ')).toBe(true);
    expect(isStateQuery('arizona')).toBe(true);
    expect(isStateQuery('Maricopa')).toBe(false);
  });
});

describe('filterZones', () => {
  it('matches city, ZIP, county, and state', () => {
    expect(filterZones(sampleZones, 'scotts').map((z) => z.id)).toEqual([
      'zone-scottsdale-85251'
    ]);
    expect(filterZones(sampleZones, '85251')).toHaveLength(1);
    expect(filterZones(sampleZones, 'Maricopa')).toHaveLength(2);
    expect(filterZones(sampleZones, 'AZ')).toHaveLength(2);
  });

  it('returns empty on miss', () => {
    expect(filterZones(sampleZones, 'Sierra Vista')).toEqual([]);
  });
});
