import type { WizardAnswers } from '../../lib/job';
import { en } from '../../i18n/en';

/** One term/detail pair for the Review step definition list. */
export interface ReviewAnswerRow {
  /** Localized field label (dt). */
  term: string;
  /** Human-readable answer value (dd). */
  detail: string;
}

/**
 * Human-readable review lines for the current wizard answers.
 * Single source of truth for the Review step UI and its unit test.
 *
 * @param answers - Controlled wizard answers.
 * @returns Ordered term/detail pairs matching the Review step.
 */
export function reviewAnswerRows(
  answers: WizardAnswers
): ReadonlyArray<ReviewAnswerRow> {
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
    }
  ];
}
