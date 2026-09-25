/** The engine for every role not listed in GROK_ALLOWED_ROLES. */
export declare const ENGINE_CLAUDE: 'claude';

/** The engine reserved for image and design-option work. */
export declare const ENGINE_GROK: 'grok';

/** Roles allowed to run on Grok: logo, palette, layout. */
export declare const GROK_ALLOWED_ROLES: readonly string[];

/**
 * Whether this role may be run on Grok at all.
 *
 * @param role Role id. Unknown, empty and non-string roles are never allowed.
 */
export declare function mayUseGrok(role: unknown): boolean;

/**
 * The primary engine for a role: grok for the design allowlist, claude for
 * everything else.
 *
 * @param role Role id.
 */
export declare function engineForRole(role: unknown): 'grok' | 'claude';
