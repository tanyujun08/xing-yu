import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoyaltySaveReview } from './LoyaltySaveReview';

afterEach(cleanup);

describe('configuration save confirmation', () => {
  it('shows the baseline and full field differences, validates the reason, and submits once', async () => {
    let complete: () => void = () => undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => { complete = resolve; }));
    function Review() {
      const [reason, setReason] = useState('');
      return <LoyaltySaveReview visible version="version-current" epoch="9007199254740993" reason={reason} onReasonChange={setReason} onCancel={() => undefined} onConfirm={save}
        differences={[{ field: 'amount', label: '安心保抵扣金额', before: '30.00 元', after: '35.00 元' }]} impacts={['已领券保持原金额。']} />;
    }
    render(<Review />);
    expect(await screen.findByText('version-current')).toBeInTheDocument();
    expect(screen.getByText('9007199254740993')).toBeInTheDocument();
    expect(screen.getByText('30.00 元')).toBeInTheDocument();
    expect(screen.getByText('35.00 元')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: '确认保存并生效' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('填写本次调整原因（3～256 个字符）'), { target: { value: '  调整安心保金额  ' } });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(save).toHaveBeenCalledExactlyOnceWith('调整安心保金额');
    expect(screen.getByRole('button', { name: '返回编辑' })).toBeDisabled();
    complete();
    await waitFor(() => expect(screen.getByRole('button', { name: '返回编辑' })).toBeEnabled());
  });
});
