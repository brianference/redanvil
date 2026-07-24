import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import {
  EMPTY_WIZARD_ANSWERS,
  countScopeSignals,
  type WizardAnswers
} from '../lib/job';
import {
  integrationChipSelected,
  reviewAnswerRows,
  toggleIntegrationChip
} from './Wizard';

describe('wizard scope options', () => {
  it('defaults optional scope to simple storage, no realtime, empty integrations', () => {
    expect(EMPTY_WIZARD_ANSWERS.dataStorage).toBe('simple');
    expect(EMPTY_WIZARD_ANSWERS.hasRealtime).toBe(false);
    expect(EMPTY_WIZARD_ANSWERS.integrations).toBe('');
  });

  it('exposes i18n copy for storage, realtime, integrations, and review labels', () => {
    expect(en.wizard.dataStorageLabel.length).toBeGreaterThan(2);
    expect(en.wizard.dataStorageOptions.none.length).toBeGreaterThan(1);
    expect(en.wizard.dataStorageOptions.simple.length).toBeGreaterThan(1);
    expect(en.wizard.dataStorageOptions.relational.length).toBeGreaterThan(1);
    expect(en.wizard.realtimeLabel.length).toBeGreaterThan(2);
    expect(en.wizard.integrationsLabel.length).toBeGreaterThan(2);
    expect(en.wizard.integrationsChips.length).toBeGreaterThanOrEqual(3);
    expect(en.wizard.reviewDataStorage.length).toBeGreaterThan(2);
    expect(en.wizard.reviewRealtime.length).toBeGreaterThan(2);
    expect(en.wizard.reviewIntegrations.length).toBeGreaterThan(2);
  });

  it('reviewAnswerRows includes every scope field for the Review step', () => {
    const answers: WizardAnswers = {
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet',
      dataStorage: 'simple',
      hasRealtime: false,
      integrations: 'Email'
    };
    const rows = reviewAnswerRows(answers);
    const terms = rows.map((r) => r.term);
    expect(terms).toContain(en.wizard.reviewPrompt);
    expect(terms).toContain(en.wizard.reviewAppType);
    expect(terms).toContain(en.wizard.reviewAuth);
    expect(terms).toContain(en.wizard.reviewEntities);
    expect(terms).toContain(en.wizard.reviewDataStorage);
    expect(terms).toContain(en.wizard.reviewRealtime);
    expect(terms).toContain(en.wizard.reviewIntegrations);
    expect(rows.find((r) => r.term === en.wizard.reviewDataStorage)?.detail).toBe(
      en.wizard.dataStorageOptions.simple
    );
    expect(rows.find((r) => r.term === en.wizard.reviewIntegrations)?.detail).toBe('Email');
  });

  it('toggles integration chips in and out of free text', () => {
    expect(integrationChipSelected('', 'Stripe')).toBe(false);
    const withStripe = toggleIntegrationChip('', 'Stripe');
    expect(withStripe).toBe('Stripe');
    expect(integrationChipSelected(withStripe, 'Stripe')).toBe(true);
    const withBoth = toggleIntegrationChip(withStripe, 'Email');
    expect(withBoth).toBe('Stripe, Email');
    const withoutStripe = toggleIntegrationChip(withBoth, 'Stripe');
    expect(withoutStripe).toBe('Email');
  });

  it('countScopeSignals rises as optional scope is filled (confidence input)', () => {
    const base: WizardAnswers = {
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app'
    };
    expect(countScopeSignals(base)).toBe(1);
    expect(
      countScopeSignals({
        ...base,
        entities: 'Reminder, Pet',
        dataStorage: 'relational',
        hasRealtime: true,
        integrations: 'Email',
        hasAuth: true
      })
    ).toBeGreaterThan(countScopeSignals(base));
  });
});
