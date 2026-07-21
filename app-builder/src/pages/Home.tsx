import { useState } from 'react';
import { Page } from '../components/Page';
import { Wizard, EMPTY_WIZARD_ANSWERS } from '../components/Wizard';
import type { BuildJob, WizardAnswers } from '../lib/job';
import { theme } from '../theme';

/** Home page: clarifying wizard that builds a job from user answers. */
export function Home(): JSX.Element {
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_WIZARD_ANSWERS);
  const [submitted, setSubmitted] = useState<BuildJob | null>(null);

  /**
   * Receive the built job from the wizard (commit path is a later surface).
   */
  function handleSubmit(job: BuildJob): void {
    setSubmitted(job);
  }

  return (
    <Page title="Build an app">
      <Wizard value={answers} onChange={setAnswers} onSubmit={handleSubmit} />
      {submitted !== null && (
        <p role="status" style={{ marginTop: theme.space.md, color: theme.color.text }}>
          Job ready: {submitted.slug} (threshold {submitted.threshold})
        </p>
      )}
    </Page>
  );
}
