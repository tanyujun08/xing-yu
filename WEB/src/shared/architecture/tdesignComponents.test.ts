import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();
async function findings(source: string, filePath = 'src/shared/ui/TDesignContractFixture.tsx') {
  const [result] = await eslint.lintText(source, { filePath });
  return result!.messages.filter((message) => message.ruleId === 'tdesign/components');
}

describe('TDesign component boundary', () => {
  it('rejects native controls in JSX and aliased React factories', async () => {
    for (const source of [
      'export const example = <input />;',
      "const Field = 'select'; export const example = <Field />;",
      "import { createElement as h } from 'react'; const control = 'button'; export const example = h(control);",
      "import * as R from 'react'; const make = R.createElement; export const example = make('form');",
      "import { jsx as h } from 'react/jsx-runtime'; export const example = h('table', {});",
      'export const example = <a href="/settings">设置</a>;',
      "import { createElement as h } from 'react'; export const example = h('a', { href: '/settings' });",
    ]) expect(await findings(source), source).toHaveLength(1);
  });

  it('accepts TDesign aliases, business layout, media, download plumbing and test fixtures', async () => {
    for (const source of [
      "import { Input as Field } from 'tdesign-react'; export const example = <Field />;",
      'export const example = <section><label>备注</label><video controls /></section>;',
      "export const link = document.createElement('a');",
      "const createElement = (tag: string) => tag; export const example = createElement('input');",
    ]) expect(await findings(source), source).toHaveLength(0);
    expect(await findings('export const fixture = <input />;', 'src/shared/ui/TDesignContractFixture.test.tsx')).toHaveLength(0);
  });
});
