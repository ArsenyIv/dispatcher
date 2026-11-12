import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

const NETWORK_MESSAGE = 'Сетевые вызовы разрешены только в src/modules/*/api'

const HTTP_LIBS = [
  'axios',
  'ky',
  'got',
  'superagent',
  'node-fetch',
  'ofetch',
  'socket.io-client',
  'ws',
  'isomorphic-ws',
  'sockjs-client',
].map((name) => ({
  name,
  message: 'HTTP и WebSocket только в слое api через клиент из модуля platform',
}))

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/*.spec.ts', 'src/**/__tests__/*'],
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  {
    name: 'rules/linter-options',
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    name: 'rules/no-ts-ignore',
    files: ['**/*.{ts,vue}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
      ],
    },
  },
  {
    name: 'rules/no-network-outside-api',
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/modules/*/api/**', '**/*.spec.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: NETWORK_MESSAGE },
        { name: 'XMLHttpRequest', message: NETWORK_MESSAGE },
        { name: 'WebSocket', message: NETWORK_MESSAGE },
        { name: 'EventSource', message: NETWORK_MESSAGE },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: NETWORK_MESSAGE },
        { object: 'globalThis', property: 'fetch', message: NETWORK_MESSAGE },
        { object: 'window', property: 'WebSocket', message: NETWORK_MESSAGE },
        { object: 'globalThis', property: 'WebSocket', message: NETWORK_MESSAGE },
        { object: 'navigator', property: 'sendBeacon', message: NETWORK_MESSAGE },
      ],
      'no-restricted-imports': ['error', { paths: HTTP_LIBS }],
    },
  },
  {
    name: 'rules/components-presentational',
    files: ['src/modules/*/components/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...HTTP_LIBS,
            { name: 'pinia', message: 'Компонент не работает со store: данные приходят через props' },
          ],
          patterns: [
            {
              regex: '.*',
              importNamePattern: '^use\\w+Store$',
              message: 'Компонент не использует store: это задача контейнера',
            },
            {
              group: ['**/api/**', '**/store/**', '**/containers/**'],
              message: 'Компонент не импортирует api, store и контейнеры',
            },
          ],
        },
      ],
    },
  },

  skipFormatting,
)