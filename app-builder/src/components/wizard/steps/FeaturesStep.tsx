import type { ChangeEvent } from 'react';
import {
  buildFeatureSuggestions,
  defaultSelectedFeatureIds
} from '../../../lib/prd/sections/features';
import { entityList } from '../../../lib/prd/naming';
import { type WizardAnswers } from '../../../lib/job';
import { en } from '../../../i18n/en';
import { theme } from '../../../theme';
import { ErrorBanner } from '../../Banner';
import { hintStyle } from '../../ui';
import { fieldLabelStyle } from '../styles';

export interface FeaturesStepProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Patch one or more answer fields. */
  patch: (partial: Partial<WizardAnswers>) => void;
  /** Whether at least one feature is selected (gates Next and shows alert). */
  featuresReady: boolean;
}

/**
 * Entity names used for feature derivation (matches generatePrd).
 *
 * @param entitiesField - Comma-separated entities from the wizard.
 * @returns Non-empty entity list (defaults to Item).
 */
export function featureEntityNames(entitiesField: string): string[] {
  const listed = entityList(entitiesField);
  return listed.length > 0 ? listed : ['Item'];
}

/**
 * Resolve the selection to display: explicit pick, or MVP defaults when unset.
 * Also drops ids that no longer exist after a Scope change.
 *
 * @param value - Wizard answers.
 * @returns Selected feature ids for checkboxes.
 */
export function resolveFeatureSelection(value: WizardAnswers): string[] {
  const entityNames = featureEntityNames(value.entities);
  const defaults = defaultSelectedFeatureIds(entityNames, value.hasAuth);
  if (value.selectedFeatureIds === null) {
    return defaults;
  }
  const validIds = new Set(buildFeatureSuggestions(entityNames, value.hasAuth).map((s) => s.id));
  const kept = value.selectedFeatureIds.filter((id) => validIds.has(id));
  return kept.length > 0 || value.selectedFeatureIds.length === 0 ? kept : defaults;
}

/**
 * Toggle a feature id in the selection list (checkbox semantics).
 *
 * @param current - Current selected ids (empty when none).
 * @param featureId - Id to add or remove.
 * @param checked - Whether the box is checked after the event.
 * @returns Next selected id list.
 */
export function toggleFeatureSelection(
  current: string[],
  featureId: string,
  checked: boolean
): string[] {
  if (checked) {
    return current.includes(featureId) ? current : [...current, featureId];
  }
  return current.filter((id) => id !== featureId);
}

/**
 * Step 3 — suggest features from the real PRD derivation; user picks which to include.
 *
 * @param props - Controlled value, patch helper, and selection readiness.
 */
export function FeaturesStep({ value, patch, featuresReady }: FeaturesStepProps): JSX.Element {
  const copy = en.wizard;
  const entityNames = featureEntityNames(value.entities);
  const suggestions = buildFeatureSuggestions(entityNames, value.hasAuth);
  const selected = resolveFeatureSelection(value);
  const selectedSet = new Set(selected);

  /**
   * Handle a checkbox change for one suggestion.
   * Always writes an explicit array so generatePrd receives the user's pick.
   */
  function onToggle(featureId: string, event: ChangeEvent<HTMLInputElement>): void {
    const next = toggleFeatureSelection(selected, featureId, event.target.checked);
    patch({ selectedFeatureIds: next });
  }

  return (
    <div>
      <p id="wizard-q-3" style={fieldLabelStyle}>
        {copy.featuresHeading}
      </p>
      <p style={hintStyle()}>{copy.featuresHint}</p>
      <ul
        className="ra-choice-grid"
        style={{
          listStyle: 'none',
          margin: `${theme.space.md}px 0 0`,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.space.sm
        }}
        aria-label={copy.featuresListLabel}
      >
        {suggestions.map((suggestion) => {
          const inputId = `wizard-feature-${suggestion.id}`;
          const checked = selectedSet.has(suggestion.id);
          return (
            <li key={suggestion.id}>
              <label
                htmlFor={inputId}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: theme.space.sm,
                  minHeight: theme.touch,
                  padding: `${theme.space.sm}px ${theme.space.md}px`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${checked ? theme.color.accent : theme.color.border}`,
                  background: checked ? theme.color.accentSoft : theme.color.surface,
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                <input
                  id={inputId}
                  name="selectedFeatures"
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    onToggle(suggestion.id, event);
                  }}
                  style={{
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    marginTop: 2,
                    flexShrink: 0,
                    accentColor: theme.color.accent
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontSize: theme.type.scale[2],
                      fontWeight: 650,
                      color: theme.color.text,
                      lineHeight: 1.35
                    }}
                  >
                    {suggestion.title}
                    {suggestion.mvp ? (
                      <span
                        style={{
                          marginLeft: theme.space.sm,
                          fontSize: theme.type.scale[1],
                          fontWeight: 600,
                          color: theme.color.accentFg
                        }}
                      >
                        {copy.featuresMvpBadge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    style={{
                      display: 'block',
                      marginTop: theme.space.xs,
                      fontSize: theme.type.scale[2],
                      color: theme.color.muted,
                      lineHeight: 1.4
                    }}
                  >
                    {suggestion.rationale}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {!featuresReady && (
        <ErrorBanner message={copy.featuresRequired} style={{ marginTop: theme.space.md }} />
      )}
    </div>
  );
}
