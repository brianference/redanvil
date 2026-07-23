import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

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
      // Dead-code detection: without these, the `u-conc-dead-code` gate blocker
      // ran the same command as `u-typing-no-any` and could only fail on `any`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-unreachable': 'error',
      'no-constant-condition': 'error',
      'no-dupe-else-if': 'error',
      'no-unsafe-negation': 'error',
      'no-console': 'off'
    }
  }
];
