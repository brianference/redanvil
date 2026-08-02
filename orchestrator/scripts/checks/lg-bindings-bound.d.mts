export interface DeclaredBinding {
  kind: 'd1' | 'ai' | 'kv' | 'r2';
  binding: string;
}
export declare function parseWranglerBindings(toml: string): DeclaredBinding[];
export declare function detectMissingBinding(
  status: number,
  body: string
): { missing: boolean; reason?: string };
export declare function probePathsForBinding(
  appDir: string,
  binding: DeclaredBinding
): string[];
export declare function readDeployUrl(appDir: string): string | null;
export declare function probeUrl(
  url: string,
  method?: 'GET' | 'POST'
): Promise<{ status: number; body: string; missing: boolean; reason?: string }>;
export declare function evaluateBindingProbes(
  bindings: DeclaredBinding[],
  probes: Array<{ binding: string; path: string; status: number; body: string }>
): { ok: boolean; failures: string[] };
export declare function runBindingsBound(
  appDir: string,
  io: {
    pass: () => never;
    fail: (m?: string) => never;
    notApplicable: (w?: string) => never;
    infra: (m?: string) => never;
  },
  opts?: { url?: string | null }
): Promise<void>;
