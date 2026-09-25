/**
 * English copy for the build job status panel.
 * Composed into the central locale bundle in ./en.ts.
 */
export const jobStatus = {
  progressLabel: 'Build progress',
  regionLabel: 'Build job status',
  heading: 'Build status',
  ownerApproval:
    'Each build is approved by the owner before it runs. Submitting a job does not start the build.',
  jobId: (id: string): string => `Job ${id}`,
  copyJobId: 'Copy job id',
  copyLabel: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  dismiss: 'Dismiss build status',
  startNew: 'Start a new app',
  loading: 'Checking build status…',
  /**
   * Icon, short badge, and one-line headline for a public status.
   * Unknown values keep the raw status instead of an invented label.
   *
   * @param status - Status string from the public endpoint.
   * @returns Badge icon, badge text, and headline.
   */
  statusPresentation: (
    status: string
  ): { icon: string; badge: string; headline: string } => {
    switch (status) {
      case 'queued':
        return { icon: '○', badge: 'Queued', headline: 'In line. Nothing has started.' };
      case 'claimed':
        return { icon: '◉', badge: 'Picked up', headline: 'A runner picked this up.' };
      case 'awaiting_owner':
        return {
          icon: '◎',
          badge: 'Awaiting approval',
          headline: 'Waiting for owner approval.'
        };
      case 'approved':
        return {
          icon: '✓',
          badge: 'Approved',
          headline: 'Approved. The build has not started.'
        };
      case 'building':
        return { icon: '…', badge: 'Building', headline: 'The build is running.' };
      case 'done':
        return { icon: '●', badge: 'Done', headline: 'The app is ready.' };
      case 'failed':
        return { icon: '!', badge: 'Failed', headline: 'The build did not finish.' };
      case 'rejected':
        return { icon: '×', badge: 'Rejected', headline: 'Rejected. It will not be built.' };
      default:
        return { icon: '?', badge: status, headline: `Status: ${status}` };
    }
  },
  /**
   * Process-map order (n8n-prototype/process-map.mjs). One list for ids and labels.
   */
  steps: [
    { id: 'prd', label: 'Product requirements' },
    { id: 'product', label: 'Product brief' },
    { id: 'brainstorm', label: 'Ranked features' },
    { id: 'inspo', label: 'Reference apps' },
    { id: 'reuse', label: 'Search existing code' },
    { id: 'logo', label: 'Brand marks' },
    { id: 'palette', label: 'Colour and type' },
    { id: 'layout', label: 'Layout options' },
    { id: 'decide', label: 'Owner picks the design' },
    { id: 'integration', label: 'Wire the data source' },
    { id: 'testwriter', label: 'Acceptance tests' },
    { id: 'build', label: 'Implement the design' },
    { id: 'content', label: 'Pages and empty states' },
    { id: 'runners', label: 'Run the test lanes' },
    { id: 'visual', label: 'Visual review' },
    { id: 'ui-live', label: 'Drive the deployed UI' },
    { id: 'qa-runtime', label: 'Check deployed routes' },
    { id: 'judge', label: 'Fresh review of the diff' },
    { id: 'qa-data', label: 'Check citations and links' },
    { id: 'user-refuse', label: 'Adversarial acceptance' },
    { id: 'pm', label: 'Assign unmet work' },
    { id: 'debugger', label: 'Find the root cause' },
    { id: 'reverify', label: 'Re-measure the deploy' },
    { id: 'ship', label: 'Deploy and prove the hash' }
  ],
  /**
   * Progress line for a known step.
   *
   * @param index - 1-based position in the catalog.
   * @param total - Catalog length.
   * @param label - Human label for that step.
   * @returns The panel line.
   */
  stepProgress: (index: number, total: number, label: string): string =>
    `Step ${index} of ${total} · ${label}`,
  openDeploy: 'Open the deployed app',
  errors: {
    invalid: 'Could not read the build status',
    loadFailed: 'Could not load the build status',
    network: 'Network error checking build status',
    timeout: 'Build status request timed out'
  },
  /**
   * Shown over the last status that did load when a later poll fails, so the
   * panel neither drops what it knew nor presents it as current.
   *
   * @param message - Why the latest poll failed.
   * @returns Warning line.
   */
  staleWarning: (message: string): string => `${message}. Showing the last status received.`
} as const;
