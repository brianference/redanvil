import { useRef, useState } from 'react';
import { Page } from '../components/Page';
import { ComposerChat } from '../components/ComposerChat';
import { TemplateGallery, type TemplateSelection } from '../components/TemplateGallery';
import { Wizard, EMPTY_WIZARD_ANSWERS } from '../components/Wizard';
import { PrdResult } from '../components/PrdResult';
import { generatePrd, type Prd } from '../lib/prd';
import { estimate } from '../lib/estimate';
import { countEntities, type BuildJob, type WizardAnswers } from '../lib/job';
import { wizardInstanceKey } from '../lib/wizardSession';
import { en } from '../i18n/en';
import { theme } from '../theme';

/** Which builder surface is active on the home route. */
type BuilderView = 'chat' | 'templates' | 'wizard' | 'result';

/**
 * Home: conversational composer → optional templates → clarifying wizard → PRD.
 * Business logic (generatePrd / estimate / submit) stays in lib + Wizard.
 */
export function Home(): JSX.Element {
  const [view, setView] = useState<BuilderView>('chat');
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_WIZARD_ANSWERS);
  const [prd, setPrd] = useState<Prd | null>(null);
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3>(1);
  /**
   * Bumped only on intentional new-wizard-session events (chat send, template
   * continue, reset). Used as the Wizard React key so typing the prompt never
   * remounts the subtree and drops focus.
   */
  const [wizardSessionId, setWizardSessionId] = useState(0);
  /** Latest answers for async submit completion (avoids stale closures). */
  const answersRef = useRef<WizardAnswers>(answers);
  answersRef.current = answers;

  const copy = en.pages.home;

  /**
   * Update controlled answers and keep the ref in sync.
   */
  function updateAnswers(next: WizardAnswers): void {
    answersRef.current = next;
    setAnswers(next);
  }

  /**
   * Start a new wizard session (remounts Wizard so internal step state resets).
   */
  function bumpWizardSession(): void {
    setWizardSessionId((id) => id + 1);
  }

  /**
   * Enter the wizard with a prompt from the chat composer.
   */
  function handleChatSend(prompt: string): void {
    updateAnswers({ ...answersRef.current, prompt });
    setWizardStartStep(2);
    bumpWizardSession();
    setView('wizard');
  }

  /**
   * Apply a template (or custom description) and open the wizard on scope.
   */
  function handleTemplateContinue(selection: TemplateSelection): void {
    const prev = answersRef.current;
    updateAnswers({
      ...prev,
      prompt: selection.prompt,
      appType: selection.appType || prev.appType
    });
    setWizardStartStep(selection.appType ? 2 : 1);
    bumpWizardSession();
    setView('wizard');
  }

  /**
   * After a successful job submit, generate the PRD from the latest answers
   * and show the result screen.
   */
  function handleJobReady(_job: BuildJob): void {
    const current = answersRef.current;
    const entityCount = countEntities(current.entities);
    const features = Math.max(1, entityCount + (current.appType.trim() ? 1 : 0));
    const cost = estimate({
      features,
      hasAuth: current.hasAuth,
      entities: entityCount
    });
    setPrd(generatePrd(current, cost));
    setView('result');
  }

  /**
   * Clear the PRD and answers; return to the chat home.
   */
  function reset(): void {
    setPrd(null);
    updateAnswers(EMPTY_WIZARD_ANSWERS);
    setWizardStartStep(1);
    bumpWizardSession();
    setView('chat');
  }

  const pageTitle =
    view === 'templates'
      ? en.templates.title
      : view === 'wizard'
        ? en.wizard.formLabel
        : view === 'result' && prd !== null
          ? prd.title
          : copy.title;

  const pageSubtitle = view === 'chat' ? copy.subtitle : undefined;

  return (
    <Page title={pageTitle} subtitle={pageSubtitle}>
      {view === 'chat' && (
        <>
          {/* Theme-aware hero: dark banner on dark, transparent light lockup on light
              (no black box on light pages). Classes own visibility — no inline display. */}
          <img
            className="ra-logo-dark"
            src="/banner.webp"
            alt={copy.bannerAlt}
            loading="eager"
            style={{
              width: '100%',
              maxWidth: '40rem',
              height: 'auto',
              borderRadius: theme.radius.lg,
              border: `1px solid ${theme.color.border}`,
              marginBottom: theme.space.xl
            }}
          />
          <img
            className="ra-logo-light"
            src="/logo-light.png"
            alt={copy.bannerAlt}
            loading="eager"
            style={{
              width: '100%',
              maxWidth: '26rem',
              height: 'auto',
              marginBottom: theme.space.xl
            }}
          />
          <ComposerChat
            prompt={answers.prompt}
            onPromptChange={(prompt) => {
              updateAnswers({ ...answersRef.current, prompt });
            }}
            onSend={handleChatSend}
            onBrowseTemplates={() => {
              setView('templates');
            }}
          />
        </>
      )}

      {view === 'templates' && (
        <TemplateGallery
          initialPrompt={answers.prompt}
          onContinue={handleTemplateContinue}
          onBack={() => {
            setView('chat');
          }}
        />
      )}

      {view === 'wizard' && (
        <Wizard
          key={wizardInstanceKey(wizardSessionId, wizardStartStep)}
          value={answers}
          onChange={updateAnswers}
          onSubmit={handleJobReady}
          initialStep={wizardStartStep}
        />
      )}

      {view === 'result' && prd !== null && <PrdResult prd={prd} onReset={reset} />}
    </Page>
  );
}
