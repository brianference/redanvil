import { useState } from 'react';
import { Page } from '../components/Page';
import { Wizard, EMPTY_WIZARD_ANSWERS } from '../components/Wizard';
import { PrdResult } from '../components/PrdResult';
import { generatePrd, type Prd } from '../lib/prd';
import { estimate } from '../lib/estimate';
import { countEntities, type WizardAnswers } from '../lib/job';

/** Home page: clarifying wizard that generates a downloadable PRD from the answers. */
export function Home(): JSX.Element {
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_WIZARD_ANSWERS);
  const [prd, setPrd] = useState<Prd | null>(null);

  /** On successful submit, generate the PRD from the current answers and show it. */
  function handleSubmit(): void {
    const entityCount = countEntities(answers.entities);
    const features = Math.max(1, entityCount + (answers.appType.trim() ? 1 : 0));
    const cost = estimate({ features, hasAuth: answers.hasAuth, entities: entityCount });
    setPrd(generatePrd(answers, cost));
  }

  /** Clear the PRD and answers to start over. */
  function reset(): void {
    setPrd(null);
    setAnswers(EMPTY_WIZARD_ANSWERS);
  }

  return (
    <Page
      title="Forge an app from a prompt"
      subtitle="Describe what you want to build. RedAnvil asks a few questions, then generates a complete PRD you can download and hand to Claude."
    >
      {prd === null ? (
        <Wizard value={answers} onChange={setAnswers} onSubmit={handleSubmit} />
      ) : (
        <PrdResult prd={prd} onReset={reset} />
      )}
    </Page>
  );
}
