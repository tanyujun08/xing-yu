import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { LoyaltySaveRecovery } from './LoyaltySaveRecovery';

afterEach(cleanup);

it('shows and retries the original request when a different draft exists', async () => {
  const original = { key: 'synthetic-original-key', body: { baseline: '7', reason: '原配置原因', amount: '30.00' } };
  const retry = vi.fn().mockResolvedValue(undefined);
  render(<LoyaltySaveRecovery intent={original} draftDifferent auditHref="/settings/operation-logs?request_id=synthetic-request"
    describeOriginal={(body) => ({ baselineEpoch: body.baseline, reason: body.reason, fields: [{ label: '原安心保金额', value: body.amount }] })} onRetry={retry} />);
  expect(screen.getByText('30.00')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();
  expect(screen.getByText('原保存原因：原配置原因')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('不能保存这份草稿');
  fireEvent.click(screen.getByRole('button', { name: '恢复原保存' }));
  await waitFor(() => expect(retry).toHaveBeenCalledExactlyOnceWith(original));
  expect(screen.getByRole('link', { name: '查询原操作记录' })).toHaveAttribute('href', '/settings/operation-logs?request_id=synthetic-request');
});
