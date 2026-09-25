import { useEffect, useState, type CSSProperties } from 'react';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { en } from '../i18n/en';
import { createActiveFlag } from '../lib/abortableEffect';
import { failureMessage, fetchJson, type FailureMessages } from '../lib/fetchJson';
import {
  JOB_STATUS_POLL_INTERVAL_MS,
  dismissTrackedJob,
  formatBuildStepLine,
  isTerminalJobStatus,
  jobStatusUrl,
  parsePublicJobStatus,
  shortJobId,
  shouldPollJob,
  shouldShowDeployLink,
  type PublicJobStatus
} from '../lib/jobStatus';
import { theme } from '../theme';
import { ErrorBanner } from './Banner';
import { buttonStyle, cardStyle } from './ui';

/** How long the inline "Copied" label stays on the job-id button. */
const COPIED_FEEDBACK_MS = 2000;

/**
 * What the panel is showing. A later poll does not flash back to loading, and
 * a failed poll after a good one keeps the last status under a warning.
 */
type PanelState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; job: PublicJobStatus; warning: string | null };

/** Result of the last copy-to-clipboard attempt, shown on the copy button. */
type CopyState = 'idle' | 'copied' | 'failed';

/** How the panel words each way a status poll can fail. */
const POLL_FAILURE_MESSAGES: FailureMessages = {
  invalidJson: en.jobStatus.errors.invalid,
  invalidPayload: en.jobStatus.errors.invalid,
  timeout: en.jobStatus.errors.timeout,
  network: en.jobStatus.errors.network,
  http: () => en.jobStatus.errors.loadFailed
};

/**
 * State after a failed poll: keep a status that already loaded, under a
 * warning, or show the error when nothing has loaded yet.
 *
 * @param previous - State before the poll.
 * @param message - Why the poll failed.
 * @returns Next state.
 */
function afterFailedPoll(previous: PanelState, message: string): PanelState {
  if (previous.status === 'ready') {
    return { ...previous, warning: en.jobStatus.staleWarning(message) };
  }
  return { status: 'error', message };
}

export interface JobStatusPanelProps {
  /** Job id returned by POST /api/submit. */
  jobId: string;
  /** Drop the tracked id in the parent so the panel unmounts. Storage is already cleared. */
  onDismiss: () => void;
  /** Drop the tracked id and return the builder to a fresh app. */
  onStartNew: () => void;
}

/** Token colors for a status pill. The icon and the word still carry the state. */
interface BadgeTone {
  fg: string;
  bg: string;
  border: string;
}

/**
 * Pick badge colors from the existing tokens. Done, failure, and the rest stay distinct
 * without introducing a color that is not already in the theme.
 *
 * @param status - Public status string.
 * @returns Foreground, background, and border token values.
 */
function badgeTone(status: string): BadgeTone {
  if (status === 'done') {
    return {
      fg: theme.color.success,
      bg: theme.color.successSoft,
      border: theme.color.success
    };
  }
  if (status === 'failed' || status === 'rejected') {
    return {
      fg: theme.color.error,
      bg: theme.color.errorSoft,
      border: theme.color.error
    };
  }
  if (status === 'building' || status === 'approved') {
    return {
      fg: theme.color.accentFg,
      bg: theme.color.accentSoft,
      border: theme.color.accent
    };
  }
  return {
    fg: theme.color.text,
    bg: theme.color.chipBg,
    border: theme.color.border
  };
}

/**
 * Status for one queued build: badge, headline, step progress, and the deploy link once it is done.
 *
 * Polls the public status endpoint every {@link JOB_STATUS_POLL_INTERVAL_MS}
 * until the job is done, failed, or rejected, or until the user dismisses the panel.
 * Each request uses an AbortController timeout, same as the other GETs in this app.
 *
 * @param props - The job id to follow, plus dismiss and start-over callbacks.
 * @returns The status panel, or null after the user hides it.
 */
export function JobStatusPanel({
  jobId,
  onDismiss,
  onStartNew
}: JobStatusPanelProps): JSX.Element | null {
  const copy = en.jobStatus;
  const [state, setState] = useState<PanelState>({ status: 'loading' });
  const [hidden, setHidden] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (copyState === 'idle') return;
    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, COPIED_FEEDBACK_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  useEffect(() => {
    if (!shouldPollJob(hidden, null)) return;
    const flag = createActiveFlag();
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let inFlight: AbortController | null = null;

    /**
     * Fetch the public status once. A cleanup abort changes nothing; terminal
     * statuses stop the interval.
     */
    async function poll(): Promise<void> {
      if (stopped || !flag.isActive()) return;
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      const result = await fetchJson(jobStatusUrl(jobId), parsePublicJobStatus, {
        signal: controller.signal
      });
      if (!result.ok) {
        if (result.kind === 'aborted') return;
        const message = failureMessage(result, POLL_FAILURE_MESSAGES);
        flag.ifActive(() => {
          setState((previous) => afterFailedPoll(previous, message));
        });
        return;
      }
      flag.ifActive(() => {
        setState({ status: 'ready', job: result.data, warning: null });
      });
      if (!shouldPollJob(false, result.data.status)) {
        stopped = true;
        if (timer !== null) clearInterval(timer);
      }
    }

    void poll();
    timer = setInterval(() => {
      void poll();
    }, JOB_STATUS_POLL_INTERVAL_MS);

    return () => {
      flag.deactivate();
      stopped = true;
      if (timer !== null) clearInterval(timer);
      inFlight?.abort();
    };
  }, [jobId, hidden]);

  /**
   * Copy the full job id and say on the button whether it worked, so a blocked
   * clipboard does not look like a successful copy or a dead button.
   */
  async function copyJobId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  /**
   * Clear the stored id and hide the panel. Polling stops because the panel unmounts
   * or, if the parent does not drop it, because `hidden` ends the effect.
   */
  function handleDismiss(): void {
    setHidden(true);
    dismissTrackedJob(onDismiss);
  }

  /**
   * Clear the stored id, hide the panel, and let the parent open a fresh app.
   */
  function handleStartNew(): void {
    setHidden(true);
    dismissTrackedJob(onStartNew);
  }

  if (hidden) return null;

  const job = state.status === 'ready' ? state.job : null;
  const presentation = job !== null ? copy.statusPresentation(job.status) : null;
  const tone = job !== null ? badgeTone(job.status) : null;
  const stepView =
    job !== null && job.status === 'building' && job.step !== null
      ? formatBuildStepLine(job.step, copy.steps, copy.stepProgress)
      : null;
  const showDeploy = job !== null && shouldShowDeployLink(job.status, job.deployUrl);
  const terminal = job !== null && isTerminalJobStatus(job.status);
  const detailIsPrimary =
    job !== null && (job.status === 'failed' || job.status === 'rejected');

  return (
    <section
      className="ra-status-panel"
      aria-label={copy.regionLabel}
      aria-live="polite"
      style={panelStyle}
    >
      <div style={topRowStyle}>
        <h2 style={headingStyle}>{copy.heading}</h2>
        <button type="button" aria-label={copy.dismiss} onClick={handleDismiss} style={closeButtonStyle}>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      {presentation !== null && tone !== null && (
        <p style={badgeStyle(tone)}>
          <span aria-hidden="true">{presentation.icon}</span>
          <span>{presentation.badge}</span>
        </p>
      )}

      {presentation !== null && <p style={headlineStyle}>{presentation.headline}</p>}

      {state.status === 'loading' && (
        <p style={headlineStyle} aria-busy="true">
          {copy.loading}
        </p>
      )}

      <p style={secondaryStyle}>{copy.ownerApproval}</p>

      <div style={idRowStyle}>
        <span style={visuallyHiddenStyle}>{copy.jobId(jobId)}</span>
        <span aria-hidden="true" style={shortIdStyle}>
          {copy.jobId(shortJobId(jobId))}
        </span>
        <button
          type="button"
          aria-label={copyButtonLabel(copyState)}
          onClick={() => {
            void copyJobId();
          }}
          style={copyButtonStyle}
        >
          {copyState === 'idle' ? copy.copyLabel : copyButtonLabel(copyState)}
        </button>
      </div>

      {state.status === 'error' && <ErrorBanner message={state.message} />}
      {state.status === 'ready' && state.warning !== null && <ErrorBanner message={state.warning} />}

      {stepView !== null && stepView.line.length > 0 && (
        <>
          <p style={bodyStyle}>{stepView.line}</p>
          {stepView.percent !== null && stepView.index !== null && stepView.total !== null && (
            <div
              role="progressbar"
              aria-label={copy.progressLabel}
              aria-valuemin={1}
              aria-valuemax={stepView.total}
              aria-valuenow={stepView.index}
              aria-valuetext={stepView.line}
              style={progressTrackStyle}
            >
              <div style={progressFillStyle(stepView.percent)} />
            </div>
          )}
        </>
      )}

      {job !== null && job.detail !== null && (
        <p style={detailIsPrimary ? bodyStyle : secondaryStyle}>{job.detail}</p>
      )}

      {(showDeploy || terminal) && (
        <div style={actionsStyle}>
          {showDeploy && job !== null && job.deployUrl !== null && (
            <SafeExternalLink href={job.deployUrl} style={primaryActionStyle}>
              {copy.openDeploy}
            </SafeExternalLink>
          )}
          {terminal && (
            <button type="button" style={secondaryActionStyle} onClick={handleStartNew}>
              {copy.startNew}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Accessible name and feedback text for the copy button.
 *
 * @param copyState - Result of the last copy attempt.
 * @returns Button label.
 */
function copyButtonLabel(copyState: CopyState): string {
  if (copyState === 'copied') return en.jobStatus.copied;
  if (copyState === 'failed') return en.jobStatus.copyFailed;
  return en.jobStatus.copyJobId;
}

/**
 * Pill style for one status. Colors come from {@link badgeTone}.
 *
 * @param tone - Token colors for this status.
 * @returns Inline style for the badge.
 */
function badgeStyle(tone: BadgeTone): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: theme.space.xs,
    margin: 0,
    fontSize: theme.type.scale[2],
    fontWeight: 650,
    lineHeight: 1.3,
    padding: `${theme.space.xs}px ${theme.space.sm}px`,
    borderRadius: theme.radius.pill,
    border: `1px solid ${tone.border}`,
    background: tone.bg,
    color: tone.fg,
    maxWidth: '100%'
  };
}

/**
 * Width of the thin progress fill.
 *
 * @param percent - 0–100 fill from the step catalog.
 * @returns Inline style for the fill.
 */
function progressFillStyle(percent: number): CSSProperties {
  return {
    width: `${percent}%`,
    height: '100%',
    background: theme.color.progressFill,
    borderRadius: theme.radius.pill
  };
}

const panelStyle: CSSProperties = {
  ...cardStyle(),
  marginBottom: theme.space.lg,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm
};

const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontFamily: theme.type.family,
  fontWeight: 600,
  fontSize: theme.type.scale[2],
  lineHeight: 1.3,
  color: theme.color.text
};

const headlineStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[3],
  fontWeight: 650,
  lineHeight: 1.3,
  color: theme.color.text,
  overflowWrap: 'anywhere'
};

const bodyStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  color: theme.color.text,
  overflowWrap: 'anywhere'
};

const secondaryStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  color: theme.color.muted,
  overflowWrap: 'anywhere'
};

const idRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm
};

const shortIdStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 600,
  lineHeight: 1.3,
  color: theme.color.text,
  whiteSpace: 'nowrap'
};

const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
};

const closeButtonStyle: CSSProperties = {
  ...buttonStyle(false),
  margin: 0,
  width: theme.touch,
  minWidth: theme.touch,
  height: theme.touch,
  minHeight: theme.touch,
  padding: 0,
  flexShrink: 0,
  fontSize: theme.type.scale[3],
  lineHeight: 1
};

const copyButtonStyle: CSSProperties = {
  ...buttonStyle(false),
  margin: 0,
  flexShrink: 0
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};

const primaryActionStyle: CSSProperties = {
  ...buttonStyle(true),
  margin: 0,
  textAlign: 'center'
};

const secondaryActionStyle: CSSProperties = {
  ...buttonStyle(false),
  margin: 0,
  textAlign: 'center'
};

const progressTrackStyle: CSSProperties = {
  height: 4,
  width: '100%',
  background: theme.color.progressTrack,
  borderRadius: theme.radius.pill,
  overflow: 'hidden'
};
