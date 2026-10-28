import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { DemoError } from '../demo';
import { MigrationBlockedState } from './DemoServicesProvider';

afterEach(() => cleanup());

describe('MigrationBlockedState', () => {

  test('offers an explicit reset for v9 strict-close migration blocks', () => {
    const error = new DemoError('PERSISTENCE_INVALID', 'Mock v9 严格终局证据不足', {
      migrationBlocked: true,
      migrationKind: 'SCHEMA_V9_TERMINAL_EVIDENCE_INCOMPLETE',
      orderId: 'order_legacy_terminal',
    });

    render(<MigrationBlockedState error={error} expectedRawBytes={'{"meta":{"schemaVersion":9}}'} />);

    expect(screen.getByText(/只有确认不再沿用这份旧版本地数据/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置为 v1.0.0.10 演示数据' })).toBeInTheDocument();
  });
});
