import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,mts,js,mjs}'],
    extends: [
      tseslint.configs.recommended,
      unicorn.configs.unopinionated,
      sonarjs.configs.recommended,
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Sonar owns number constants and unused names. Unicorn prefers global
      // NaN; Sonar prefers Number.NaN.
      'unicorn/prefer-global-number-constants': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
