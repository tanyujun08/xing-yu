import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const nativeControls = new Set(['input', 'textarea', 'select', 'option', 'button', 'form', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'progress', 'a']);
const tdesignComponents = {
  meta: { type: 'problem', schema: [], messages: { native: '后台交互控件 {{tag}} 必须使用 TDesign 或基于 TDesign 的共享组件。' } },
  create(context) {
    const source = context.sourceCode;
    const definition = (node) => {
      let scope = source.getScope(node);
      while (scope) {
        const variable = scope.set.get(node.name);
        if (variable) return variable.defs[0];
        scope = scope.upper;
      }
    };
    const resolve = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return null;
      seen.add(node);
      if (node.type === 'Literal') return node.value;
      if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
        const def = definition(node);
        if (def?.type === 'Variable') return resolve(def.node.init, seen);
      }
      return null;
    };
    const reactFactory = (node, seen = new Set()) => {
      if (!node || seen.has(node)) return false;
      seen.add(node);
      if (node.type === 'Identifier') {
        const def = definition(node);
        if (def?.type === 'ImportBinding') return ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(def.parent.source.value)
          && ['createElement', 'jsx', 'jsxs', 'jsxDEV'].includes(def.node.imported?.name);
        if (def?.type === 'Variable') return reactFactory(def.node.init, seen);
      }
      if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && (node.computed ? resolve(node.property) : node.property.name) === 'createElement') {
        const def = definition(node.object);
        return def?.type === 'ImportBinding' && def.parent.source.value === 'react';
      }
      return false;
    };
    const report = (node, tag) => {
      if (nativeControls.has(tag)) context.report({ node, messageId: 'native', data: { tag } });
    };
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier') return;
        report(node, /^[a-z]/.test(node.name.name) ? node.name.name : resolve(node.name));
      },
      CallExpression(node) { if (reactFactory(node.callee)) report(node, resolve(node.arguments[0])); },
    };
  },
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/shared/api/generated/schema.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/preview/**/*.js'], languageOptions: { globals: globals.browser } },
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: ['permissions', 'roleDefinitions', 'useSession', 'useApiClient', 'useDemoServices'],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts'],
    plugins: { tdesign: { rules: { components: tdesignComponents } } },
    rules: { 'tdesign/components': 'error' },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'react-router-dom', importNames: ['Link', 'NavLink'], message: '页面链接使用基于 TDesign 的 AdminRouteLink，保留客户端路由语义。' }],
          patterns: [
            {
              group: ['**/shared/api/**'],
              message: 'Mock Demo 页面只能通过 shared/services 的领域 Gateway 访问数据。',
            },
            {
              group: ['**/shared/mock/**'],
              message: '页面不得直接读取 Fixture 或 MockStore；请使用 shared/services。',
            },
          ],
        },
      ],
    },
  },
);
