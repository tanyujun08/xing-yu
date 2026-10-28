import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { figmaBoards, findFigmaBoard, figmaFileKey } from '../miniprogram/shared/design/figma-map';

test('keeps the documented Figma entries traceable to native routes', () => {
  expect(figmaFileKey).toBe('5srSnlaI9DwEchNeGOHrqb');
  expect(new Set(figmaBoards.map((board) => board.sourceNodeId)).size).toBe(figmaBoards.length);
  expect(new Set(figmaBoards.map((board) => board.nodeId)).size).toBe(figmaBoards.length);
  expect(findFigmaBoard('62:787')?.route).toBe('/pages/home/index');
  expect(findFigmaBoard('2102:1416')?.route).toBe('/pages/profile/index');
  expect(findFigmaBoard('2102:929')?.route).toBe('/pages/listing-price/index');
  expect(findFigmaBoard('2102:534')?.route).toBe('/pages/membership/index');
  expect(findFigmaBoard('2007:26')?.route).toBe('/pages/home/index');
  expect(findFigmaBoard('53:87')).toBeUndefined();
  // Derived ids are positional (`derived:<index>`), so which numbers are free depends on the
  // current route list; the contract is that an id outside the assigned range never resolves.
  expect(findFigmaBoard('derived:0')).toBeUndefined();
  expect(findFigmaBoard('derived:999')).toBeUndefined();
  // A route already traced to a direct Figma board keeps only its direct entry, because the
  // derived duplicate is filtered out rather than renumbered.
  for (const direct of figmaBoards.filter((board) => board.designSource === 'figma' && board.surface === 'page')) {
    expect(figmaBoards.filter((board) => board.surface === 'page' && board.route === direct.route)).toHaveLength(1);
  }
  for (const board of figmaBoards) {
    expect(board.sourceNodeId).toMatch(board.designSource === 'figma' ? /^\d+:\d+$/ : /^derived:\d+$/);
  }
  for (const route of ['/pages/address-edit/index', '/pages/coupons/index', '/pages/admin-approval/index', '/pages/order-fees/index']) {
    expect(figmaBoards.find((board) => board.route === route)).toMatchObject({ surface: 'page', designSource: 'derived' });
  }
  expect(figmaBoards.every((board) => board.route.startsWith('/pages/'))).toBe(true);
  const registeredRoutes = (JSON.parse(readFileSync('miniprogram/app.json', 'utf8')) as { pages: string[] }).pages
    .map((route) => `/${route}`)
    .sort();
  const mappedPageRoutes = figmaBoards.filter((board) => board.surface === 'page').map((board) => board.route).sort();
  expect(mappedPageRoutes).toEqual(registeredRoutes);
});
