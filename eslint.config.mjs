import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueTsEslintConfig from '@vue/eslint-config-typescript';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  // ===================
  // Global ignores
  // ===================
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/scripts/**'],
  },

  // ===================
  // Base configs
  // ===================
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  // ===================
  // All TypeScript files - common settings
  // ===================
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off', // TypeScript handles this
    },
  },

  // ===================
  // Frontend (Vue.js) specific configuration
  // ===================
  // Apply Vue plugin to .vue files
  ...pluginVue.configs['flat/recommended'].map((config) => ({
    ...config,
    files: ['frontend/**/*.vue'],
  })),
  // Vue TypeScript support
  ...vueTsEslintConfig({
    extends: ['recommended'],
  }).map((config) => ({
    ...config,
    files: ['frontend/**/*.vue', 'frontend/**/*.ts'],
  })),
  // Vue-specific rules
  {
    files: ['frontend/**/*.vue'],
    rules: {
      // Vue best practices
      'vue/multi-word-component-names': 'off', // Allow single-word components
      'vue/no-v-html': 'warn', // Warn about XSS risks
      'vue/require-default-prop': 'off', // Not needed with TypeScript
      'vue/require-prop-types': 'off', // TypeScript handles this
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-macros-order': [
        'error',
        { order: ['defineOptions', 'defineModel', 'defineProps', 'defineEmits', 'defineSlots'] },
      ],
      'vue/no-unused-refs': 'warn',
    },
  },
  // Skip Prettier formatting conflicts
  ...[skipFormatting].flat().map((config) => ({
    ...config,
    files: ['frontend/**/*.vue', 'frontend/**/*.ts'],
  })),

  // ===================
  // Backend (Node.js/Express) specific rules
  // ===================
  {
    files: ['backend/**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
      globals: {
        // Node.js globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      // Node.js best practices
      'no-console': 'off', // Allow console in backend
      '@typescript-eslint/no-require-imports': 'off', // Allow require in Node.js
    },
  },

  // ===================
  // Shared library
  // ===================
  {
    files: ['shared/**/*.ts'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },

  // ===================
  // Config files at root
  // ===================
  {
    files: ['*.mjs', '*.js', '*.ts', '*.config.ts', '*.config.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
];
