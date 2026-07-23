import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/**
 * Root lint config. Covers `.tsx` as well as `.ts`: the previous
 * `files: ['**\/*.ts']` meant every React component in both apps was linted by
 * nothing in `npm run lint` or CI.
 *
 * The rule set is deliberately more than `no-explicit-any`. With only that rule
 * enabled, the `u-conc-dead-code` gate check ran the identical eslint command as
 * `u-typing-no-any` and could only ever fail on an `any` — so a blocker named
 * "dead code" never looked for dead code, and two entirely unused modules
 * survived a 100/100 gate.
 */
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: false, ecmaFeatures: { jsx: true } }
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Dead-code detection. `argsIgnorePattern` allows the deliberate `_job`
      // style for a parameter a signature requires but the body does not use.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ],
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-dupe-else-if': 'error',
      'no-unsafe-negation': 'error',
      'no-console': 'off'
    }
  }
];
