// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Constitution enforcement lives here:
 *  - Principle II: only src/playback/YouTubeTimeSource.ts and src/playback/loadYouTubeApi.ts
 *    may reference the YouTube IFrame API globals.
 *  - Principle I/IV: src/engine/** and src/data/** stay framework-free (no React / DOM libs).
 */
const youtubeGlobals = [
  {
    name: 'YT',
    message:
      'The YouTube IFrame API may only be referenced in src/playback/YouTubeTimeSource.ts and src/playback/loadYouTubeApi.ts (constitution: Host-Agnostic Playback).',
  },
  {
    name: 'onYouTubeIframeAPIReady',
    message:
      'The YouTube IFrame API may only be referenced in src/playback/YouTubeTimeSource.ts and src/playback/loadYouTubeApi.ts (constitution: Host-Agnostic Playback).',
  },
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'specs/**', '.specify/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-globals': ['error', ...youtubeGlobals],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },
  {
    // Framework-free layers: pure TypeScript only.
    files: ['src/engine/**/*.ts', 'src/data/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/engine/** and src/data/** must stay framework-free.' },
            { name: 'react-dom', message: 'src/engine/** and src/data/** must stay framework-free.' },
            {
              name: 'react-router',
              message: 'src/engine/** and src/data/** must stay framework-free.',
            },
          ],
          patterns: ['react-dom/*', '@testing-library/*'],
        },
      ],
    },
  },
  {
    // Context providers legitimately export a provider component and its hook.
    files: [
      'src/data/ShowContext.tsx',
      'src/data/CrawlersContext.tsx',
      'src/data/RegistryContext.tsx',
      'src/data/RegistryIndexContext.tsx',
      // 011: <Seo> ships with the pure helpers that build the same tags for the
      // server's head string; splitting them would separate two halves of one
      // contract.
      'src/site/seo.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // The two adapter files are the only place the YouTube globals are allowed.
    files: ['src/playback/YouTubeTimeSource.ts', 'src/playback/loadYouTubeApi.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
