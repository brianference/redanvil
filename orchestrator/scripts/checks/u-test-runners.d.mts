/**
 * Types for u-test-runners.mjs — per-runner fail-closed gate.
 */

export interface DetectedRunner {
  name: string;
  configured: boolean;
  command: string;
  args: string[];
}

export interface RunnerResult {
  name: string;
  passed: boolean;
  output: string;
  exitCode: number | null;
}

export interface TestRunnersIo {
  pass: () => void;
  fail: (m?: string) => void;
  notApplicable: (w?: string) => void;
  infra?: (m?: string) => void;
}

export declare function detectRunners(appDir: string): DetectedRunner[];

export declare function runOneRunner(
  appDir: string,
  runner: DetectedRunner
): RunnerResult;

export declare function runTestRunners(
  appDir: string,
  io: TestRunnersIo,
  deps?: {
    detect?: typeof detectRunners;
    run?: typeof runOneRunner;
  }
): void;
