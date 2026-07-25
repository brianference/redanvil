import type { ChangeEvent } from 'react';
import { en } from '../../i18n/en';
import { chipStyle, fieldStyle, labelStyle } from '../ui';
import {
  chipsStyle,
  composerBlockStyle,
  orDividerLineStyle,
  orDividerStyle
} from './styles';

export interface TemplateComposerProps {
  /** Controlled free-text prompt. */
  customPrompt: string;
  /**
   * Update the composer and clear archetype selection (user is free-forming).
   *
   * @param value - New textarea value.
   */
  onCustomPromptChange: (value: string) => void;
  /**
   * Apply an example prompt chip (also clears archetype selection).
   *
   * @param prompt - Example prompt text to seed.
   */
  onExampleSelect: (prompt: string) => void;
}

/**
 * “Or describe your own” divider, custom prompt field, and example chips.
 *
 * @param props - Controlled prompt and change handlers.
 */
export function TemplateComposer({
  customPrompt,
  onCustomPromptChange,
  onExampleSelect
}: TemplateComposerProps): JSX.Element {
  const copy = en.templates;
  return (
    <>
      <div style={orDividerStyle} role="separator">
        <span style={orDividerLineStyle} aria-hidden="true" />
        <span>{copy.orDescribe}</span>
        <span style={orDividerLineStyle} aria-hidden="true" />
      </div>

      <div style={composerBlockStyle}>
        <label htmlFor="template-custom-prompt" style={labelStyle()}>
          {copy.composerLabel}
        </label>
        <textarea
          id="template-custom-prompt"
          name="customPrompt"
          rows={3}
          value={customPrompt}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onCustomPromptChange(event.target.value);
          }}
          placeholder={copy.composerPlaceholder}
          style={fieldStyle()}
          aria-describedby="template-empty-hint"
        />
      </div>

      <div style={chipsStyle} role="group" aria-label={copy.examplesLabel}>
        {en.chat.examples.map((example) => (
          <button
            key={example.title}
            type="button"
            style={chipStyle(false)}
            onClick={() => {
              onExampleSelect(example.prompt);
            }}
          >
            {example.title}
          </button>
        ))}
      </div>
    </>
  );
}
