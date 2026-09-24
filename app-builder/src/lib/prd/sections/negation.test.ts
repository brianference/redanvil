import { describe, expect, it } from 'vitest';
import { clauseIsNegated, clausesWithNegation } from './negation';

describe('clauseIsNegated', () => {
  it('matches the negation forms the n8n helper documents', () => {
    expect(clauseIsNegated('it is not a marketplace')).toBe(true);
    expect(clauseIsNegated("it isn't a calendar")).toBe(true);
    expect(clauseIsNegated('never books appointments')).toBe(true);
    expect(clauseIsNegated('no login required')).toBe(true);
    expect(clauseIsNegated('rather than a spreadsheet')).toBe(true);
    expect(clauseIsNegated('instead of email')).toBe(true);
    expect(clauseIsNegated('not a scheduler')).toBe(true);
    expect(clauseIsNegated('not an app store')).toBe(true);
    expect(clauseIsNegated('does not schedule shifts')).toBe(true);
    expect(clauseIsNegated('do not book rooms')).toBe(true);
    expect(clauseIsNegated('tracks care history')).toBe(false);
    expect(clauseIsNegated('tracks care history', true)).toBe(true);
  });
});

describe('clausesWithNegation', () => {
  it('negates only the clause that carries the negation', () => {
    const clauses = clausesWithNegation(
      'it is not a job board, it is a marketplace for buyers and sellers'
    );
    expect(clauses.find((clause) => clause.text.includes('job board'))?.negated).toBe(true);
    expect(clauses.find((clause) => clause.text.includes('marketplace'))?.negated).toBe(false);
  });

  it('negates the whole sentence that opens with "what this is not"', () => {
    const clauses = clausesWithNegation(
      'What this is NOT: a booking tool, or a roster. It tracks vaccines.'
    );
    const booking = clauses.filter(
      (clause) => clause.text.includes('booking') || clause.text.includes('roster')
    );
    expect(booking.length).toBeGreaterThan(0);
    expect(booking.every((clause) => clause.negated)).toBe(true);
    expect(clauses.find((clause) => clause.text.includes('tracks'))?.negated).toBe(false);
  });
});
