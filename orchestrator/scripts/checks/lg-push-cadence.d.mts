/** Max unpushed commits allowed before the rule fails. */
export declare const PUSH_CADENCE_THRESHOLD: number;

export type PushCadenceVerdict =
  | {
      kind: 'pass';
      count: number;
      deferred?: boolean;
      message?: string;
    }
  | {
      kind: 'fail';
      count: number;
      message: string;
    }
  | {
      kind: 'notApplicable';
      reason: string;
    }
  | {
      kind: 'error';
      message: string;
    };

export type PushCadenceIo = {
  pass: () => never;
  fail: (msg?: string) => never;
  notApplicable: (why?: string) => never;
};

/** Result of resolving HEAD's configured upstream (`@{upstream}`). */
export type UpstreamResolve =
  | { ok: true; ref: string }
  | { ok: false; reason: 'none' }
  | { ok: false; reason: 'error'; message: string };

export type PushCadenceDeps = {
  isInsideWorkTree?: (cwd: string) => boolean | null;
  getUpstream?: (cwd: string) => UpstreamResolve;
  countAhead?: (cwd: string, remoteRef: string) => number | null;
  isPrePush?: () => boolean;
};

export declare function defaultIsInsideWorkTree(cwd: string): boolean | null;
export declare function defaultGetUpstream(cwd: string): UpstreamResolve;
export declare function defaultCountAhead(
  cwd: string,
  remoteRef: string
): number | null;
export declare function defaultIsPrePush(): boolean;
export declare function cadenceFailMessage(count: number): string;
export declare function evaluatePushCadence(input: {
  count: number | null;
  hasRemoteTracking: boolean | null;
  prePush?: boolean;
  measureError?: string | null;
}): PushCadenceVerdict;
export declare function runLgPushCadence(
  appDir: string,
  io: PushCadenceIo,
  deps?: PushCadenceDeps
): void;
