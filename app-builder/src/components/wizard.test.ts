import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import {
  EMPTY_WIZARD_ANSWERS,
  countScopeSignals,
  isFeatureContinueBlocked,
  isFeatureSelectionReady,
  type WizardAnswers
} from '../lib/job';
import {
  integrationChipSelected,
  reviewAnswerRows,
  toggleFeatureSelection,
  toggleIntegrationChip
} from './Wizard';

describe('wizard scope options', () => {
  it('defaults optional scope to simple storage, no realtime, empty integrations', () => {
    expect(EMPTY_WIZARD_ANSWERS.dataStorage).toBe('simple');
    expect(EMPTY_WIZARD_ANSWERS.hasRealtime).toBe(false);
    expect(EMPTY_WIZARD_ANSWERS.integrations).toBe('');
    expect(EMPTY_WIZARD_ANSWERS.selectedFeatureIds).toBeNull();
  });

  it('exposes i18n copy for storage, realtime, integrations, features, and review labels', () => {
    expect(en.wizard.dataStorageLabel.length).toBeGreaterThan(2);
    expect(en.wizard.dataStorageOptions.none.length).toBeGreaterThan(1);
    expect(en.wizard.dataStorageOptions.simple.length).toBeGreaterThan(1);
    expect(en.wizard.dataStorageOptions.relational.length).toBeGreaterThan(1);
    expect(en.wizard.realtimeLabel.length).toBeGreaterThan(2);
    expect(en.wizard.integrationsLabel.length).toBeGreaterThan(2);
    expect(en.wizard.integrationsChips.length).toBeGreaterThanOrEqual(3);
    expect(en.wizard.featuresHeading.length).toBeGreaterThan(2);
    expect(en.wizard.featuresRequired.length).toBeGreaterThan(2);
    expect(en.wizard.reviewDataStorage.length).toBeGreaterThan(2);
    expect(en.wizard.reviewRealtime.length).toBeGreaterThan(2);
    expect(en.wizard.reviewIntegrations.length).toBeGreaterThan(2);
    expect(en.wizard.reviewFeatures.length).toBeGreaterThan(2);
    expect(en.wizard.stepTitles).toEqual(['App idea', 'Scope', 'Features', 'Review']);
  });

  it('reviewAnswerRows includes every scope field and chosen features for the Review step', () => {
    const answers: WizardAnswers = {
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet',
      dataStorage: 'simple',
      hasRealtime: false,
      integrations: 'Email',
      selectedFeatureIds: ['F1', 'F4']
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
    expect(terms).toContain(en.wizard.reviewFeatures);
    expect(rows.find((r) => r.term === en.wizard.reviewDataStorage)?.detail).toBe(
      en.wizard.dataStorageOptions.simple
    );
    expect(rows.find((r) => r.term === en.wizard.reviewIntegrations)?.detail).toBe('Email');
    const featureDetail = rows.find((r) => r.term === en.wizard.reviewFeatures)?.detail ?? '';
    expect(featureDetail).toContain('Browse & search');
    expect(featureDetail).toContain('Manage Reminder');
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

describe('wizard feature selection Continue gate', () => {
  it('blocks Continue when nothing is selected (explicit empty list)', () => {
    const answers: WizardAnswers = {
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      entities: 'Reminder, Pet',
      selectedFeatureIds: []
    };
    expect(isFeatureSelectionReady(answers)).toBe(false);
    expect(isFeatureContinueBlocked(answers.selectedFeatureIds)).toBe(true);
    // Wizard Next uses the same gate: empty selection must disable Continue.
    expect(
      answers.selectedFeatureIds !== null && answers.selectedFeatureIds.length === 0
    ).toBe(true);
  });

  it('allows Continue when at least one feature is selected', () => {
    const answers: WizardAnswers = {
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      selectedFeatureIds: ['F1']
    };
    expect(isFeatureSelectionReady(answers)).toBe(true);
    expect(isFeatureContinueBlocked(answers.selectedFeatureIds)).toBe(false);
  });

  it('toggleFeatureSelection deselects and can empty the list (UI path for the gate)', () => {
    const only = toggleFeatureSelection(['F1'], 'F1', false);
    expect(only).toEqual([]);
    expect(isFeatureSelectionReady({ ...EMPTY_WIZARD_ANSWERS, selectedFeatureIds: only })).toBe(
      false
    );
    expect(isFeatureContinueBlocked(only)).toBe(true);
    const restored = toggleFeatureSelection(only, 'F2', true);
    expect(restored).toEqual(['F2']);
    expect(
      isFeatureSelectionReady({ ...EMPTY_WIZARD_ANSWERS, selectedFeatureIds: restored })
    ).toBe(true);
    expect(isFeatureContinueBlocked(restored)).toBe(false);
  });
});
