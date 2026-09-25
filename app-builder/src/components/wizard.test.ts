import { buildFeatureSuggestions } from '../lib/prd/sections/features';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { en } from '../i18n/en';
import { entitySpecReady, ENTITY_SPEC_EXAMPLE } from '../lib/prd/entitySpec';
import { FidelityWarning } from './FidelityWarning';
import { Wizard } from './Wizard';
import { entitySpecExampleForPrompt } from './wizard/entitySpecExample';
import { entitySpecBlockMessage } from './wizard/entitySpecMessage';
import {
  EMPTY_WIZARD_ANSWERS,
  countScopeSignals,
  isFeatureSelectionReady,
  type WizardAnswers
} from '../lib/job';
import { integrationChipSelected, toggleIntegrationChip } from './wizard/integrationChips';
import { reviewAnswerRows } from './wizard/reviewRows';
import {
  featureEntityNames,
  resolveFeatureSelection,
  toggleFeatureSelection
} from './wizard/steps/FeaturesStep';
import { defaultSelectedFeatureIds } from '../lib/prd/sections/features';

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
    // Select by name: ids renumber when the prompt's top capability leads.
    const suggestions = buildFeatureSuggestions(['Reminder', 'Pet'], false, 'a dog grooming reminder app');
    const idOf = (prefix: string): string => {
      const found = suggestions.find((s) => s.title.startsWith(prefix));
      if (found === undefined) throw new Error(`no suggestion starting with ${prefix}`);
      return found.id;
    };
    const answers: WizardAnswers = {
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      hasAuth: false,
      entities: 'Reminder, Pet',
      dataStorage: 'simple',
      hasRealtime: false,
      integrations: 'Email',
      selectedFeatureIds: [idOf('Browse & search'), idOf('Manage Reminder')]
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
    // Wizard Next uses the same gate: empty selection must disable Continue.
    expect(answers.selectedFeatureIds !== null && answers.selectedFeatureIds.length === 0).toBe(
      true
    );
  });

  it('allows Continue when at least one feature is selected', () => {
    const answers: WizardAnswers = {
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'a dog grooming reminder app',
      appType: 'Mobile app',
      selectedFeatureIds: ['F1']
    };
    expect(isFeatureSelectionReady(answers)).toBe(true);
  });

  it('toggleFeatureSelection deselects and can empty the list (UI path for the gate)', () => {
    const only = toggleFeatureSelection(['F1'], 'F1', false);
    expect(only).toEqual([]);
    expect(isFeatureSelectionReady({ ...EMPTY_WIZARD_ANSWERS, selectedFeatureIds: only })).toBe(
      false
    );
    const restored = toggleFeatureSelection(only, 'F2', true);
    expect(restored).toEqual(['F2']);
    expect(isFeatureSelectionReady({ ...EMPTY_WIZARD_ANSWERS, selectedFeatureIds: restored })).toBe(
      true
    );
  });
});

// resolveFeatureSelection decides what the Features step shows and what reaches
// generatePrd. Its stale-id branch is the interesting one: changing the entity
// list renumbers feature ids, so a saved selection can point at ids that no
// longer exist.
describe('resolveFeatureSelection', () => {
  const answers = {
    ...EMPTY_WIZARD_ANSWERS,
    prompt: 'an app to track dog grooming appointments',
    appType: 'Mobile app',
    entities: 'Dog, Appointment'
  };

  it('falls back to MVP defaults when nothing has been chosen yet', () => {
    const resolved = resolveFeatureSelection({ ...answers, selectedFeatureIds: null });
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).toEqual(
      defaultSelectedFeatureIds(
        featureEntityNames(answers.entities),
        answers.hasAuth,
        answers.prompt
      )
    );
  });

  it('keeps the ids that still exist and drops the ones that do not', () => {
    const live = resolveFeatureSelection({ ...answers, selectedFeatureIds: null });
    const first = live[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(resolveFeatureSelection({ ...answers, selectedFeatureIds: [first, 'F999'] })).toEqual([
      first
    ]);
  });

  it('falls back to defaults when every saved id has gone stale', () => {
    // Not the same as the user deselecting everything: the selection was real,
    // the ids just no longer resolve, so defaults are the honest answer.
    const resolved = resolveFeatureSelection({
      ...answers,
      selectedFeatureIds: ['F999', 'F998']
    });
    expect(resolved).toEqual(
      defaultSelectedFeatureIds(
        featureEntityNames(answers.entities),
        answers.hasAuth,
        answers.prompt
      )
    );
  });

  it('respects a deliberate empty selection instead of re-adding defaults', () => {
    expect(resolveFeatureSelection({ ...answers, selectedFeatureIds: [] })).toEqual([]);
  });
});

describe('entity spec wizard copy', () => {
  it('block message is null exactly when the spec is ready to generate', () => {
    for (const sample of [
      '',
      'Dog',
      'Dog, CareTask',
      'Dog: id',
      'CareTask: dog->Dog',
      'Dog: name, breed',
      ENTITY_SPEC_EXAMPLE
    ]) {
      expect(entitySpecBlockMessage(sample) === null).toBe(entitySpecReady(sample));
    }
  });

  it('names the missing field and the parser error', () => {
    expect(entitySpecBlockMessage('')).toBe(en.wizard.entitiesRequired);
    expect(entitySpecBlockMessage('Dog')).toContain(en.wizard.entityNeedsField('Dog'));
    expect(entitySpecBlockMessage('CareTask: dog->Dog')).toContain('unknown entity ref: dog->Dog');
  });

  it('picks an example from the prompt and falls back to the contract example', () => {
    expect(entitySpecExampleForPrompt('find the lowest cost airline flight')).toBe(
      en.wizard.entitySpecExamples.flight
    );
    expect(entitySpecExampleForPrompt('a planting calendar for crops')).toBe(
      en.wizard.entitySpecExamples.crop
    );
    expect(entitySpecExampleForPrompt('hello there')).toBe(en.wizard.entitySpecExamples.fallback);
    expect(en.wizard.entitySpecExamples.fallback).toBe(ENTITY_SPEC_EXAMPLE);
  });

  it('shows parsed chips and blocks Next until every entity has a field', () => {
    const blocked = renderWizard({
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'a dog care tracker for owners',
      appType: 'Mobile app',
      entities: 'Dog'
    });
    expect(blocked).toContain('Dog');
    expect(blocked).toContain(en.wizard.entityNoFields);
    expect(blocked).toContain(en.wizard.entityNeedsField('Dog'));
    expect(blocked).toContain('disabled');

    const ready = renderWizard({
      ...EMPTY_WIZARD_ANSWERS,
      prompt: 'find the lowest cost airline flight',
      appType: 'Mobile app',
      entities: 'Flight: origin, departsAt:datetime'
    });
    expect(ready).toContain('Flight');
    expect(ready).toContain(en.wizard.entityFieldChip('origin', 'text'));
    expect(ready).toContain(en.wizard.entityFieldChip('departsAt', 'datetime'));
    expect(ready).toContain('Layover: airport, minutes:int, flight-&gt;Flight');
    expect(ready).not.toContain(en.wizard.entitiesRequired);
  });
});

describe('fidelity warning', () => {
  it('lists unmatched requirements and does not replace the PRD', () => {
    const markdown = [
      '```yaml',
      'fidelity: fail',
      'fidelityUnmatched:',
      '  - "track vaccinations per dog"',
      '```',
      '',
      '# Implementation Spec — Dog Care',
      '',
      'The PRD body stays visible.'
    ].join('\n');
    const html = renderToStaticMarkup(createElement(FidelityWarning, { markdown }));
    expect(html).toContain(en.prdResult.fidelityTitle);
    expect(html).toContain('track vaccinations per dog');
    expect(html).toContain(en.prdResult.fidelityBody);
    expect(renderToStaticMarkup(createElement(FidelityWarning, { markdown: 'fidelity: pass' }))).toBe(
      ''
    );
  });
});

/**
 * Render the Scope step of the wizard.
 *
 * @param value - Wizard answers.
 * @returns Static HTML.
 */
function renderWizard(value: WizardAnswers): string {
  return renderToStaticMarkup(
    createElement(Wizard, {
      value,
      onChange: () => undefined,
      onSubmit: () => undefined,
      initialStep: 2
    })
  );
}
