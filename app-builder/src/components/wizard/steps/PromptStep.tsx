import type { ChangeEvent } from 'react';
import { MIN_PROMPT_LENGTH, type WizardAnswers } from '../../../lib/job';
import { en } from '../../../i18n/en';
import { theme } from '../../../theme';
import { chipStyle, fieldStyle, hintStyle } from '../../ui';
import { chipsRowStyle, fieldLabelStyle } from '../styles';

export interface PromptStepProps {
  /** Controlled wizard answers. */
  value: WizardAnswers;
  /** Patch one or more answer fields. */
  patch: (partial: Partial<WizardAnswers>) => void;
}

/**
 * Step 1 — free-text app description with example idea chips.
 *
 * @param props - Controlled value and patch helper.
 */
export function PromptStep({ value, patch }: PromptStepProps): JSX.Element {
  const copy = en.wizard;
  return (
    <div>
      <label htmlFor="wizard-prompt" id="wizard-q-1" style={fieldLabelStyle}>
        {copy.promptLabel}
      </label>
      <p style={hintStyle()}>{copy.promptHint(MIN_PROMPT_LENGTH)}</p>
      <textarea
        id="wizard-prompt"
        name="prompt"
        required
        minLength={MIN_PROMPT_LENGTH}
        rows={5}
        value={value.prompt}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          patch({ prompt: event.target.value })
        }
        placeholder={copy.promptPlaceholder}
        style={{ ...fieldStyle(), minHeight: 120, marginTop: theme.space.sm }}
        aria-describedby="wizard-prompt-hint"
      />
      <p id="wizard-prompt-hint" style={hintStyle()}>
        {value.prompt.trim().length}/{MIN_PROMPT_LENGTH}+
      </p>
      <div style={chipsRowStyle} role="group" aria-label={copy.exampleIdeasLabel}>
        {copy.exampleIdeas.map((idea) => (
          <button
            key={idea}
            type="button"
            style={chipStyle(value.prompt.includes(idea))}
            onClick={() => {
              patch({ prompt: `A ${idea.toLowerCase()} app` });
            }}
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
