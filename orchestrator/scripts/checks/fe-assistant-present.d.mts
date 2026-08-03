export declare function hasQueryableDomainData(appDir: string): boolean;
export declare function findAssistantEndpoints(appDir: string): string[];
export declare function hasAssistantUi(joined: string): boolean;
export declare function assessAssistantEndpoint(endpointText: string): { ok: boolean; why?: string };
export declare function readDeployUrl(appDir: string): string | null;
export interface AssistantGroundingFixture {
  message: string;
  crossCheckPath: string;
  assistantField: string;
  crossCheckField: string;
}
export declare function readGroundingFixture(appDir: string): AssistantGroundingFixture | null;
export declare function extractFieldList(value: unknown, path: string): string[];
export declare function verifyLiveGrounding(
  base: string,
  fixture: AssistantGroundingFixture,
  fetchImpl?: typeof fetch
): Promise<{ ok: boolean; infra?: boolean; why?: string }>;
export declare function runAssistantPresent(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra?: (m?: string) => never;
  }
): Promise<void>;
