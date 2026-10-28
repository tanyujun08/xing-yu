import { describe, expect, it } from 'vitest';

const featureSources = import.meta.glob('../../features/**/*.{ts,tsx}', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

const reactSources = import.meta.glob('../../**/*.tsx', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

describe('frontend architecture contracts', () => {
  const features = Object.entries(featureSources).filter(([file]) => !file.includes('.test.'));

  it('keeps feature pages behind the environment-neutral services boundary', () => {
    for (const [file, source] of features) {
      expect(source, file).not.toContain('useDemoServices');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*shared\/(mock|api)(?:\/|['"])/);
      expect(source, file).not.toMatch(/actorId\s*:\s*['"]/);
    }
  });

  it('requires scoped query keys and protects AdminListPanel internals', () => {
    for (const [file, source] of features) {
      expect(source, file).not.toMatch(/queryKey\s*:\s*\[['"]demo['"]/);
      expect(source, file).not.toContain('admin-list-panel__');
    }
  });

  it('uses the shared confirmation contract instead of browser-native confirms', () => {
    for (const [file, source] of Object.entries(reactSources).filter(([file]) => !file.includes('.test.'))) {
      expect(source, file).not.toContain('window.confirm');
    }
  });
});
