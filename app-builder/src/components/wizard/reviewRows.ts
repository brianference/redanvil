import type { WizardAnswers } from '../../lib/job';
import { en } from '../../i18n/en';
import { entityList } from '../../lib/prd/naming';
import { buildFeatureSuggestions } from '../../lib/prd/sections/features';

/** One term/detail pair for the Review step definition list. */
export interface ReviewAnswerRow {
  /** Localized field label (dt). */
  term: string;
  /** Human-readable answer value (dd). */
  detail: string;
}

/**
 * Resolve chosen feature titles for the Review step.
 * Uses the same derivation as the Features step / PRD so the list matches.
 *
 * @param answers - Controlled wizard answers.
 * @returns Comma-separated feature titles, or empty-state copy.
 */
export function chosenFeatureDetail(answers: WizardAnswers): string {
  const copy = en.wizard;
  if (answers.selectedFeatureIds === null) {
    return copy.reviewNotSet;
  }
  if (answers.selectedFeatureIds.length === 0) {
    return copy.reviewNone;
  }
  const listed = entityList(answers.entities);
  const entityNames = listed.length > 0 ? listed : ['Item'];
  const suggestions = buildFeatureSuggestions(entityNames, answers.hasAuth);
  const byId = new Map(suggestions.map((s) => [s.id, s.title]));
  const titles = answers.selectedFeatureIds
    .map((id) => byId.get(id))
    .filter((title): title is string => typeof title === 'string' && title.length > 0);
  return titles.length > 0 ? titles.join(', ') : copy.reviewNone;
}

/**
 * Human-readable review lines for the current wizard answers.
 * Single source of truth for the Review step UI and its unit test.
 *
 * @param answers - Controlled wizard answers.
 * @returns Ordered term/detail pairs matching the Review step.
 */
export function reviewAnswerRows(answers: WizardAnswers): ReadonlyArray<ReviewAnswerRow> {
  const copy = en.wizard;
  return [
    { term: copy.reviewPrompt, detail: answers.prompt.trim() || copy.reviewEmpty },
    { term: copy.reviewAppType, detail: answers.appType.trim() || copy.reviewNotSet },
    { term: copy.reviewAuth, detail: answers.hasAuth ? copy.reviewYes : copy.reviewNo },
    { term: copy.reviewEntities, detail: answers.entities.trim() || copy.reviewNone },
    { term: copy.reviewDataStorage, detail: copy.dataStorageOptions[answers.dataStorage] },
    { term: copy.reviewRealtime, detail: answers.hasRealtime ? copy.reviewYes : copy.reviewNo },
    {
      term: copy.reviewIntegrations,
      detail: answers.integrations.trim() || copy.reviewNone
    },
    { term: copy.reviewFeatures, detail: chosenFeatureDetail(answers) }
  ];
}
