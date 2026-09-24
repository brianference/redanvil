import type { ChangeEvent } from 'react';
import { type DataStorage, type WizardAnswers } from '../../../lib/job';
import { parseEntitySpec } from '../../../lib/prd/entitySpec';
import { en } from '../../../i18n/en';
import { theme } from '../../../theme';
import { ErrorBanner } from '../../Banner';
import { chipStyle, fieldStyle, hintStyle, labelStyle } from '../../ui';
import { entitySpecExampleForPrompt } from '../entitySpecExample';
import { entitySpecBlockMessage } from '../entitySpecMessage';
import { integrationChipSelected, toggleIntegrationChip } from '../integrationChips';
import { chipsRowStyle, fieldLabelStyle } from '../styles';

export interface ScopeStepProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Patch one or more answer fields. */
  patch: (partial: Partial<WizardAnswers>) => void;
  /** Whether app type is non-empty (gates Next and shows alert). */
  appTypeReady: boolean;
}

/**
 * Step 2 — structured scope: app type, auth, entities, storage, realtime, integrations.
 *
 * @param props - Controlled value, patch helper, and app-type readiness.
 */
export function ScopeStep({ value, patch, appTypeReady }: ScopeStepProps): JSX.Element {
  const copy = en.wizard;
  const parsed = parseEntitySpec(value.entities);
  const entityBlock = entitySpecBlockMessage(value.entities);
  const example = entitySpecExampleForPrompt(value.prompt);
  return (
    <div>
      <p id="wizard-q-2" style={fieldLabelStyle}>
        {copy.appTypeLabel}
      </p>
      <div style={chipsRowStyle} role="group" aria-label={copy.appTypeChipsLabel}>
        {copy.appTypeChips.map((chip) => {
          const selected = value.appType === chip;
          return (
            <button
              key={chip}
              type="button"
              style={chipStyle(selected)}
              aria-pressed={selected}
              onClick={() => {
                patch({ appType: chip });
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>
      <label htmlFor="wizard-app-type" style={{ ...labelStyle(), marginTop: theme.space.md }}>
        {copy.appTypeLabel}
      </label>
      <input
        id="wizard-app-type"
        name="appType"
        type="text"
        value={value.appType}
        onChange={(event: ChangeEvent<HTMLInputElement>) => patch({ appType: event.target.value })}
        placeholder={copy.appTypePlaceholder}
        style={fieldStyle()}
      />

      <p style={{ ...fieldLabelStyle, marginTop: theme.space.lg }} id="wizard-auth-label">
        {copy.authGroupLabel}
      </p>
      <div style={chipsRowStyle} role="group" aria-labelledby="wizard-auth-label">
        <button
          type="button"
          style={chipStyle(value.hasAuth)}
          aria-pressed={value.hasAuth}
          onClick={() => {
            patch({ hasAuth: true });
          }}
        >
          {copy.authYes}
        </button>
        <button
          type="button"
          style={chipStyle(!value.hasAuth)}
          aria-pressed={!value.hasAuth}
          onClick={() => {
            patch({ hasAuth: false });
          }}
        >
          {copy.authNo}
        </button>
      </div>

      <label htmlFor="wizard-entities" style={{ ...labelStyle(), marginTop: theme.space.lg }}>
        {copy.entitiesLabel}
      </label>
      <textarea
        id="wizard-entities"
        name="entities"
        value={value.entities}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => patch({ entities: event.target.value })}
        placeholder={copy.entitiesPlaceholder}
        style={{ ...fieldStyle(), minHeight: theme.touch * 2 }}
        rows={4}
        aria-describedby={
          entityBlock !== null ? 'wizard-entities-hint wizard-entities-errors' : 'wizard-entities-hint'
        }
        aria-invalid={entityBlock !== null}
      />
      <p id="wizard-entities-hint" style={hintStyle()}>
        {copy.entitiesHint} {copy.entitiesExampleLead} {example}
      </p>
      {parsed.entities.length > 0 && (
        <ul
          aria-label={copy.entitiesPreviewLabel}
          style={{
            ...chipsRowStyle,
            listStyle: 'none',
            margin: `${theme.space.sm}px 0 0`,
            padding: 0
          }}
        >
          {parsed.entities.map((entity, index) => (
            <li
              key={`${entity.name}-${index}`}
              style={{
                ...chipStyle(false),
                cursor: 'default',
                minHeight: theme.touch,
                fontSize: theme.type.scale[2],
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: theme.space.xs
              }}
            >
              <span style={{ fontWeight: 700 }}>{entity.name}</span>
              {entity.fields.length === 0 ? (
                <span>{copy.entityNoFields}</span>
              ) : (
                <span>
                  {entity.fields
                    .map((field) =>
                      copy.entityFieldChip(
                        field.name,
                        field.ref !== undefined ? `->${field.ref}` : field.type
                      )
                    )
                    .join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {entityBlock !== null && (
        <div id="wizard-entities-errors">
          <ErrorBanner message={entityBlock} style={{ marginTop: theme.space.md }} />
        </div>
      )}

      <p style={{ ...fieldLabelStyle, marginTop: theme.space.lg }} id="wizard-storage-label">
        {copy.dataStorageLabel}
      </p>
      <p style={hintStyle()}>{copy.dataStorageHint}</p>
      <div style={chipsRowStyle} role="group" aria-labelledby="wizard-storage-label">
        {(
          [
            ['none', copy.dataStorageOptions.none],
            ['simple', copy.dataStorageOptions.simple],
            ['relational', copy.dataStorageOptions.relational]
          ] as const
        ).map(([key, label]) => {
          const selected = value.dataStorage === key;
          return (
            <button
              key={key}
              type="button"
              style={chipStyle(selected)}
              aria-pressed={selected}
              onClick={() => {
                const storage: DataStorage = key;
                patch({ dataStorage: storage });
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p style={{ ...fieldLabelStyle, marginTop: theme.space.lg }} id="wizard-realtime-label">
        {copy.realtimeLabel}
      </p>
      <p style={hintStyle()}>{copy.realtimeHint}</p>
      <div style={chipsRowStyle} role="group" aria-labelledby="wizard-realtime-label">
        <button
          type="button"
          style={chipStyle(value.hasRealtime)}
          aria-pressed={value.hasRealtime}
          onClick={() => {
            patch({ hasRealtime: true });
          }}
        >
          {copy.realtimeYes}
        </button>
        <button
          type="button"
          style={chipStyle(!value.hasRealtime)}
          aria-pressed={!value.hasRealtime}
          onClick={() => {
            patch({ hasRealtime: false });
          }}
        >
          {copy.realtimeNo}
        </button>
      </div>

      <label htmlFor="wizard-integrations" style={{ ...labelStyle(), marginTop: theme.space.lg }}>
        {copy.integrationsLabel}
      </label>
      <p style={hintStyle()}>{copy.integrationsHint}</p>
      <div style={chipsRowStyle} role="group" aria-label={copy.integrationsChipsLabel}>
        {copy.integrationsChips.map((chip) => {
          const selected = integrationChipSelected(value.integrations, chip);
          return (
            <button
              key={chip}
              type="button"
              style={chipStyle(selected)}
              aria-pressed={selected}
              onClick={() => {
                patch({ integrations: toggleIntegrationChip(value.integrations, chip) });
              }}
            >
              {chip}
            </button>
          );
        })}
      </div>
      <input
        id="wizard-integrations"
        name="integrations"
        type="text"
        value={value.integrations}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          patch({ integrations: event.target.value })
        }
        placeholder={copy.integrationsPlaceholder}
        style={{ ...fieldStyle(), marginTop: theme.space.sm }}
      />

      {!appTypeReady && (
        <ErrorBanner message={copy.appTypeRequired} style={{ marginTop: theme.space.md }} />
      )}
    </div>
  );
}
