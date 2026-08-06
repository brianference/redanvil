import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/** Flat ESLint config for the generated app (u-typing-no-any, u-conc-dead-code). */
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
