import { useEffect, useState } from 'react';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { en } from '../i18n/en';
import {
  FETCH_TIMEOUT_MS,
  createActiveFlag,
  isAbortError
} from '../lib/abortableEffect';
import { messageFromPayload } from '../lib/apiError';
import {
  JOB_STATUS_POLL_INTERVAL_MS,
  isTerminalJobStatus,
  jobStatusUrl,
  parsePublicJobStatus,
  type PublicJobStatus
} from '../lib/jobStatus';
import { theme } from '../theme';
import { cardStyle, errorBannerStyle } from './ui';

/** What the panel is showing. A later poll does not flash back to loading. */
type PanelState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; job: PublicJobStatus };

export interface JobStatusPanelProps {
  /** Job id returned by POST /api/submit. */
  jobId: string;
}

/**
 * Status for one queued build: plain-language state, the step while it is
 * building, and the deploy link once it is done.
 *
 * Polls the public status endpoint every {@link JOB_STATUS_POLL_INTERVAL_MS}
 * until the job is done, failed, or rejected. Each request uses an
 * AbortController timeout, same as the other GETs in this app.
 *
 * @param props - The job id to follow.
 * @returns The status panel.
 */
export function JobStatusPanel({ jobId }: JobStatusPanelProps): JSX.Element {
  const copy = en.jobStatus;
  const [state, setState] = useState<PanelState>({ status: 'loading' });

  useEffect(() => {
    const flag = createActiveFlag();
    let timer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;
    let inFlight: AbortController | null = null;

    /**
     * Fetch the public status once. A timeout sets an error; a cleanup abort
     * does not. Terminal statuses stop the interval.
     */
    async function poll(): Promise<void> {
      if (stopped || !flag.isActive()) return;
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(jobStatusUrl(jobId), { signal: controller.signal });
        clearTimeout(timeoutId);
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          flag.ifActive(() => {
            setState({ status: 'error', message: copy.errors.invalid });
          });
          return;
        }
        if (!response.ok) {
          flag.ifActive(() => {
            setState({
              status: 'error',
              message: messageFromPayload(payload, copy.errors.loadFailed)
            });
          });
          return;
        }
        const job = parsePublicJobStatus(payload);
        if (job === null) {
          flag.ifActive(() => {
            setState({ status: 'error', message: copy.errors.invalid });
          });
          return;
        }
        flag.ifActive(() => {
          setState({ status: 'ready', job });
        });
        if (isTerminalJobStatus(job.status)) {
          stopped = true;
          if (timer !== null) clearInterval(timer);
        }
      } catch (error: unknown) {
        clearTimeout(timeoutId);
        if (!flag.isActive()) return;
        if (isAbortError(error)) {
          if (timedOut) {
            setState({ status: 'error', message: copy.errors.timeout });
          }
          return;
        }
        setState({ status: 'error', message: copy.errors.network });
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
  }, [jobId, copy]);

  const job = state.status === 'ready' ? state.job : null;
  const showStep = job !== null && job.status === 'building' && job.step !== null;
  const showLink = job !== null && job.status === 'done' && job.deployUrl !== null;

  return (
    <section aria-label={copy.regionLabel} aria-live="polite" style={panelStyle}>
      <p style={headingStyle}>{copy.heading}</p>
      <p style={bodyStyle}>{copy.ownerApproval}</p>
      <p style={bodyStyle}>{copy.jobId(jobId)}</p>
      {state.status === 'loading' && (
        <p style={bodyStyle} aria-busy="true">
          {copy.loading}
        </p>
      )}
      {state.status === 'error' && (
        <div role="alert" style={{ ...errorBannerStyle(), marginTop: theme.space.sm }}>
          <span aria-hidden="true">!</span>
          <span>{state.message}</span>
        </div>
      )}
      {job !== null && (
        <p style={bodyStyle}>{copy.statusText(job.status)}</p>
      )}
      {showStep && job.step !== null && <p style={bodyStyle}>{copy.stepText(job.step)}</p>}
      {job !== null && job.detail !== null && (
        <p style={bodyStyle}>{copy.detailText(job.detail)}</p>
      )}
      {showLink && job.deployUrl !== null && (
        <p style={bodyStyle}>
          <SafeExternalLink href={job.deployUrl} style={linkStyle}>
            {copy.openDeploy}
          </SafeExternalLink>
        </p>
      )}
    </section>
  );
}

const panelStyle = {
  ...cardStyle(),
  marginBottom: theme.space.lg
};

const headingStyle = {
  margin: 0,
  fontWeight: 600,
  fontSize: theme.type.scale[2],
  color: theme.color.text
};

const bodyStyle = {
  margin: `${theme.space.xs}px 0 0`,
  fontSize: theme.type.scale[2],
  lineHeight: 1.4,
  color: theme.color.text,
  wordBreak: 'break-word' as const
};

const linkStyle = {
  color: theme.color.accentFg,
  fontWeight: 600
};
