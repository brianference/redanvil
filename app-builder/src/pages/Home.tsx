import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Page } from '../components/Page';
import { ComposerChat } from '../components/ComposerChat';
import { TemplateGallery, type TemplateSelection } from '../components/TemplateGallery';
import { Wizard, EMPTY_WIZARD_ANSWERS } from '../components/Wizard';
import { PrdResult } from '../components/PrdResult';
import { ErrorBanner } from '../components/Banner';
import { buttonStyle } from '../components/ui';
import { generatePrd, UnresolvedPrdError, type Prd } from '../lib/prd';
import { estimate } from '../lib/estimate';
import { countEntities, countScopeSignals, type BuildJob, type WizardAnswers } from '../lib/job';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { theme } from '../theme';

/** Which builder surface is active on the home route. */
type BuilderView = 'chat' | 'templates' | 'wizard' | 'result';

/**
 * Outcome of client-side PRD generation after a successful job submit.
 * Mirrors Saved / SavedPrd / PrdResult: explicit error vs success (no silent throw).
 */
type ForgeResultState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; prd: Prd };

/**
 * Home: conversational composer → optional templates → clarifying wizard → PRD.
 * Business logic (generatePrd / estimate / submit) stays in lib + Wizard.
 */
export function Home(): JSX.Element {
  const [view, setView] = useState<BuilderView>('chat');
  const [answers, setAnswers] = useState<WizardAnswers>(EMPTY_WIZARD_ANSWERS);
  const [forgeResult, setForgeResult] = useState<ForgeResultState>({ status: 'idle' });
  const [wizardStartStep, setWizardStartStep] = useState<1 | 2 | 3 | 4>(1);
  /**
   * Bumped only on intentional new-wizard-session events (chat send, template
   * continue, reset). Used as the Wizard React key so typing the prompt never
   * remounts the subtree and drops focus.
   */
  const [wizardSessionId, setWizardSessionId] = useState(0);
  /** Latest answers for async submit completion (avoids stale closures). */
  const answersRef = useRef<WizardAnswers>(answers);
  answersRef.current = answers;

  // Each builder surface (chat → templates → wizard → result) swaps in via state,
  // not a route change, so the browser keeps the previous scroll position — you
  // click "Start from a template" partway down the page and land partway down the
  // new one. Reset to the top whenever the surface changes. `smooth` respects
  // prefers-reduced-motion via the browser.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [view]);

  const copy = en.pages.home;

  useDocumentMeta({
    title: 'RedAnvil — Forge apps from a prompt',
    description:
      'RedAnvil turns a prompt into a complete, downloadable PRD you can hand to Claude — with a token estimate and an enforced quality gate.',
    path: '/'
  });

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
    // An archetype names its own app type; the "describe your own" path returns
    // an empty one, which means "this template did not pick a type" — NOT "the
    // type is empty". So it keeps whatever is already answered (the default on
    // a fresh session), and still opens on Prompt so the user confirms their own
    // wording. The two readings looked interchangeable while the default was
    // '' and only diverged once it was not; naming the flag keeps them apart.
    const templatePickedType = selection.appType.trim().length > 0;
    updateAnswers({
      ...prev,
      prompt: selection.prompt,
      appType: templatePickedType ? selection.appType : prev.appType
    });
    setWizardStartStep(templatePickedType ? 2 : 1);
    bumpWizardSession();
    setView('wizard');
  }

  /**
   * After a successful job submit, generate the PRD from the latest answers
   * and show the result screen. UnresolvedPrdError (and any other throw) must
   * surface as a real error panel — never an uncaught exception on the core path.
   */
  function handleJobReady(_job: BuildJob): void {
    const current = answersRef.current;
    const entityCount = countEntities(current.entities);
    const features = Math.max(1, entityCount + (current.appType.trim() ? 1 : 0));
    const cost = estimate({
      features,
      hasAuth: current.hasAuth,
      entities: entityCount,
      scopeSignals: countScopeSignals(current)
    });
    try {
      const prd = generatePrd(current, cost);
      setForgeResult({ status: 'success', prd });
      setView('result');
    } catch (err) {
      const message =
        err instanceof UnresolvedPrdError
          ? err.message
          : err instanceof Error
            ? err.message
            : copy.forgeError;
      setForgeResult({ status: 'error', message });
      setView('result');
    }
  }

  /**
   * Return to the wizard so the user can fix entities or the product name.
   */
  function backToWizard(): void {
    setForgeResult({ status: 'idle' });
    setView('wizard');
  }

  /**
   * Clear the PRD and answers; return to the chat home.
   */
  function reset(): void {
    setForgeResult({ status: 'idle' });
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
        : view === 'result' && forgeResult.status === 'success'
          ? forgeResult.prd.title
          : view === 'result' && forgeResult.status === 'error'
            ? copy.forgeErrorLabel
            : copy.title;

  const pageSubtitle = view === 'chat' ? copy.subtitle : undefined;

  return (
    <Page title={pageTitle} subtitle={pageSubtitle}>
      {view === 'chat' && (
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
          key={`wizard-${wizardSessionId}-${wizardStartStep}`}
          value={answers}
          onChange={updateAnswers}
          onSubmit={handleJobReady}
          initialStep={wizardStartStep}
        />
      )}

      {view === 'result' && forgeResult.status === 'error' && (
        <section style={forgeErrorRootStyle} aria-label={copy.forgeErrorLabel}>
          <ErrorBanner message={forgeResult.message} />
          <div style={forgeErrorActionsStyle}>
            <button type="button" style={buttonStyle(true)} onClick={backToWizard}>
              {copy.forgeErrorBack}
            </button>
            <button type="button" style={buttonStyle(false)} onClick={reset}>
              {copy.forgeErrorNew}
            </button>
          </div>
        </section>
      )}

      {view === 'result' && forgeResult.status === 'success' && (
        <PrdResult prd={forgeResult.prd} onReset={reset} />
      )}

      {view === 'result' && forgeResult.status === 'idle' && (
        <section style={forgeErrorRootStyle} aria-label={copy.forgeErrorLabel}>
          <ErrorBanner message={copy.forgeError} />
          <div style={forgeErrorActionsStyle}>
            <button type="button" style={buttonStyle(true)} onClick={backToWizard}>
              {copy.forgeErrorBack}
            </button>
            <button type="button" style={buttonStyle(false)} onClick={reset}>
              {copy.forgeErrorNew}
            </button>
          </div>
        </section>
      )}
    </Page>
  );
}

const forgeErrorRootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md
};

const forgeErrorActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};
