import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMockCursorPager, type MockCursorItem } from '../miniprogram/shared/api/mock-adapter/pagination';
import { createCursorList, type CursorListPatch } from '../miniprogram/shared/interaction/cursor-list';
import type { PageRequest } from '../miniprogram/shared/model/pagination';
import { getMockDiamondLedger, resetFixture } from '../miniprogram/shared/fixture';
import { readMockState } from '../miniprogram/shared/fixture/mock-store';

interface TestItem extends MockCursorItem {
  value: string;
}

const initialRequest: PageRequest = {
  mode: 'initial',
  cursor: null,
  generation: null,
  pageSize: 20,
};

function testItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${String(index).padStart(4, '0')}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    value: `value-${index}`,
  }));
}

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), 'miniprogram', path), 'utf8');
}

describe('Mock opaque cursor pagination', () => {
  beforeEach(() => resetFixture());

  test.each([
    [100, 5],
    [500, 25],
  ])('reads an uncapped %i-item snapshot in exactly %i pages', (itemCount, expectedCalls) => {
    const pager = createMockCursorPager<TestItem>();
    const source = testItems(itemCount);
    const ids: string[] = [];
    let calls = 0;
    let page = pager.page('large-list', initialRequest, () => source);
    calls += 1;
    ids.push(...page.items.map((item) => item.id));
    while (page.hasMore) {
      page = pager.page('large-list', {
        mode: 'load-more',
        cursor: page.nextCursor,
        generation: page.generation,
        pageSize: 20,
      }, () => { throw new Error('load-more must reuse the frozen snapshot'); });
      calls += 1;
      ids.push(...page.items.map((item) => item.id));
    }
    expect(calls).toBe(expectedCalls);
    expect(ids).toHaveLength(itemCount);
    expect(new Set(ids)).toHaveLength(itemCount);
  });

  test('sorts by createdAt DESC then id DESC before taking the first page', () => {
    const pager = createMockCursorPager<TestItem>();
    const page = pager.page('stable-sort', initialRequest, () => [
      { id: 'order-a', createdAt: '2026-09-01T10:00:00.000Z', value: 'a' },
      { id: 'order-c', createdAt: '2026-09-01T10:00:00.000Z', value: 'c' },
      { id: 'order-b', createdAt: '2026-09-01T10:00:00.000Z', value: 'b' },
      { id: 'order-new', createdAt: '2026-09-01T11:00:00.000Z', value: 'new' },
    ]);
    expect(page.items.map((item) => item.id)).toEqual(['order-new', 'order-c', 'order-b', 'order-a']);
  });

  test('keeps cursors opaque and retry-stable, then rejects the old generation after refresh', () => {
    const pager = createMockCursorPager<TestItem>();
    const source = testItems(61);
    const first = pager.page('retry-list', initialRequest, () => source);
    expect(first.nextCursor).toMatch(/^mock-cursor-[0-9a-z]+$/);
    expect(source.some((item) => first.nextCursor?.includes(item.id))).toBe(false);
    const request: PageRequest = {
      mode: 'load-more',
      cursor: first.nextCursor,
      generation: first.generation,
      pageSize: 20,
    };
    const firstAttempt = pager.page('retry-list', request, () => source);
    const retry = pager.page('retry-list', request, () => source);
    expect(retry).toEqual(firstAttempt);

    const refreshed = pager.page('retry-list', { ...initialRequest, mode: 'refresh', generation: first.generation }, () => source);
    expect(refreshed.generation).not.toBe(first.generation);
    expect(() => pager.page('retry-list', request, () => source)).toThrow('Stale Mock cursor generation');
  });

  test('single-flights the same cursor and emits only new items[n] patches under 64 KiB', async () => {
    const pager = createMockCursorPager<TestItem>();
    const source = testItems(45);
    const patches: Array<CursorListPatch<{ id: string; label: string }>> = [];
    const load = vi.fn((request: PageRequest) => pager.page('controller-list', request, () => source));
    const present = vi.fn((item: TestItem) => ({ id: item.id, label: item.value }));
    const list = createCursorList({
      load,
      present,
      getId: (item: TestItem) => item.id,
      onPatch: (patch) => patches.push(patch),
    });

    await list.initial();
    expect(load).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledTimes(20);
    await Promise.all(Array.from({ length: 10 }, () => list.loadMore()));
    expect(load).toHaveBeenCalledTimes(2);
    expect(present).toHaveBeenCalledTimes(40);
    const append = [...patches].reverse().find((patch) => patch.append?.length === 20)?.append;
    expect(append?.map((row) => row.path)).toEqual(Array.from({ length: 20 }, (_, index) => `items[${20 + index}]`));
    expect(append?.some((row) => row.path === 'items[0]')).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(append), 'utf8')).toBeLessThan(64 * 1024);
    list.dispose();
  });

  test('retains rows after load-more failure and retries the identical cursor without gaps', async () => {
    const pager = createMockCursorPager<TestItem>();
    const source = testItems(45);
    const loadMoreRequests: PageRequest[] = [];
    let failNextLoadMore = true;
    const list = createCursorList({
      load: (request: PageRequest) => {
        if (request.mode === 'load-more') {
          loadMoreRequests.push({ ...request });
          if (failNextLoadMore) {
            failNextLoadMore = false;
            throw new Error('temporary load-more failure');
          }
        }
        return pager.page('retry-controller-list', request, () => source);
      },
      present: (item: TestItem) => ({ id: item.id, label: item.value }),
      getId: (item: TestItem) => item.id,
      onPatch: () => undefined,
    });

    await list.initial();
    const firstPageIds = list.rows.map((row) => row.id);
    await list.loadMore();
    expect(list.state).toEqual({ phase: 'ready', incremental: 'load-more-error' });
    expect(list.rows.map((row) => row.id)).toEqual(firstPageIds);

    await list.loadMore();
    expect(loadMoreRequests).toHaveLength(2);
    expect(loadMoreRequests[1]).toEqual(loadMoreRequests[0]);
    const expectedIds = [...source]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .slice(0, 40)
      .map((item) => item.id);
    expect(list.rows.map((row) => row.id)).toEqual(expectedIds);
    expect(new Set(list.rows.map((row) => row.id))).toHaveLength(40);
    expect(list.state).toEqual({ phase: 'ready', incremental: 'idle' });
    list.dispose();
  });

  test('filters diamond entries before paging without mutating the fixture', () => {
    const before = readMockState();
    const expectedIncome = getMockDiamondLedger()
      .filter((entry) => entry.direction === 'credit' || entry.direction === 'release');
    const pager = createMockCursorPager<(typeof expectedIncome)[number]>();
    const income = pager.page('diamond-income', initialRequest, () => expectedIncome);
    const expectedIds = [...expectedIncome]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
      .slice(0, 20).map((entry) => entry.id);
    expect(income.items.map((entry) => entry.id)).toEqual(expectedIds);
    expect(income.items.every((entry) => entry.direction === 'credit' || entry.direction === 'release')).toBe(true);
    expect(readMockState()).toEqual(before);
  });

  test('wires both pilot pages to natural scrolling, pure refresh and the shared facade', () => {
    const ordersTs = readProjectFile('pages/orders/index.ts');
    const ordersWxml = readProjectFile('pages/orders/index.wxml');
    const ordersJson = JSON.parse(readProjectFile('pages/orders/index.json')) as Record<string, unknown>;
    const ledgerTs = readProjectFile('pages/powder-ledger/index.ts');
    const ledgerWxml = readProjectFile('pages/powder-ledger/index.wxml');
    const ledgerJson = JSON.parse(readProjectFile('pages/powder-ledger/index.json')) as Record<string, unknown>;

    const ledgerController = readProjectFile('shared/interaction/account-ledger-page.ts');
    for (const source of [ledgerController]) {
      expect(source).toMatch(/async onPullDownRefresh\(/u);
      expect(source).toContain('finally');
      expect(source).toContain('wx.stopPullDownRefresh()');
      expect(source).toMatch(/onReachBottom\(/u);
      expect(source).not.toContain("shared/fixture");
    }
    expect(ordersTs).toContain('createRentalOrdersPage');
    expect(readProjectFile('shared/interaction/order-unavailable.ts')).toContain('wx.stopPullDownRefresh()');
    expect(ordersTs).not.toContain('mockApi');
    expect(ledgerTs).toContain("pointApi.list('PINK', cursor, filter === 'income' ? 'INCREASE' : filter === 'expense' ? 'DECREASE' : undefined)");
    expect(ledgerTs).not.toContain('mockApi');
    expect(ordersTs).not.toContain('rentalApi');
    expect(ledgerTs).toContain('createAccountLedgerPage');
    expect(ledgerController).toContain('settings.load(request.cursor, runtime.filter)');
    expect(ordersWxml).toContain('wx:for="{{items}}"');
    expect(ordersWxml).toContain('filter === item.id');
    expect(ledgerWxml).toContain('wx:for="{{items}}"');
    expect(ledgerWxml).not.toContain('最近 100 条');
    expect(ledgerTs).not.toMatch(/\.slice\(\s*0\s*,\s*100\s*\)/);
    expect(ordersJson).toMatchObject({ enablePullDownRefresh: true, onReachBottomDistance: 120 });
    expect(ledgerJson).toMatchObject({ enablePullDownRefresh: true, onReachBottomDistance: 120 });
    expect(ordersWxml).not.toContain('scroll-y=');
    expect(ledgerWxml).not.toContain('scroll-y=');
    expect(readProjectFile('shared/presentation/diamond-ledger.ts')).not.toContain('shared/fixture');
  });


});
