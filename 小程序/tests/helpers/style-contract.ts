import { readFileSync } from 'node:fs';

/** Default top-level declarations only; this is not a browser cascade/layout engine. */
export function styleRule(style: string, selector: string): Record<string, string> {
  const clean = style.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
  const result: Record<string, string> = {};
  let start = 0;
  while (start < clean.length) {
    const open = clean.indexOf('{', start);
    if (open < 0) break;
    let close = open + 1;
    let depth = 1;
    while (close < clean.length && depth) {
      if (clean[close] === '{') depth++;
      if (clean[close] === '}') depth--;
      close++;
    }
    const selectors = clean.slice(start, open).trim();
    if (!selectors.startsWith('@') && selectors.split(',').some((part) => part.trim() === selector)) {
      for (const declaration of clean.slice(open + 1, close - 1).split(';')) {
        const colon = declaration.indexOf(':');
        if (colon >= 0) result[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
      }
    }
    start = close;
  }
  return result;
}

/** Expand default app/member token aliases; leave calc/env expressions explicit. */
export function resolveStyleValue(value: string): string {
  const defaults = readFileSync('miniprogram/app.wxss', 'utf8') + readFileSync('miniprogram/shared/design/member-tokens.wxss', 'utf8');
  // Scoped journey themes do not override unrelated pages' default tokens.
  const tokens = styleRule(defaults, 'page');
  for (let count = 0; count < 30 && value.includes('var('); count++) {
    const next = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (match: string, name: string, fallback: string | undefined) => tokens[name] ?? fallback ?? match);
    if (next === value) break;
    value = next;
  }
  return value.replace(/\s+/g, ' ').trim();
}

export function styleValue(style: string, selector: string, property: string): string {
  return resolveStyleValue(styleRule(style, selector)[property] ?? '');
}
