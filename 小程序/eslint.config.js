import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const miniprogramGlobals = {
  App: 'readonly',
  Page: 'readonly',
  Component: 'readonly',
  Behavior: 'readonly',
  getApp: 'readonly',
  getCurrentPages: 'readonly',
  wx: 'readonly',
};

export default tseslint.config(
  { ignores: ['coverage', 'miniprogram_npm', 'miniprogram/miniprogram_npm/**', 'types/api/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['miniprogram/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: miniprogramGlobals,
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
);
