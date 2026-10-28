import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { LoyaltyTextInput } from './LoyaltyTextInput';
import { parseLoyaltyMoney } from './loyaltyInputs';

afterEach(cleanup);

it('preserves invalid raw input and shows the same validation on blur and submit', () => {
  function Field() {
    const [value, setValue] = useState('30.00');
    return <LoyaltyTextInput name="amount" label="安心保抵扣金额（元）" value={value} onChange={setValue} parse={parseLoyaltyMoney} />;
  }
  render(<Field />);
  const input = screen.getByRole('textbox', { name: '安心保抵扣金额（元）' });
  fireEvent.change(input, { target: { value: '1.234' } });
  expect(input).toHaveValue('1.234');
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.blur(input);
  expect(screen.getByRole('alert')).toHaveTextContent('请输入有效人民币金额，最多两位小数，不含符号或前导零。');
  expect(input).toHaveValue('1.234');
  cleanup();
  render(<LoyaltyTextInput name="amount" label="金额" value="1.234" onChange={() => undefined} parse={parseLoyaltyMoney} submitted />);
  expect(screen.getByRole('alert')).toHaveTextContent('最多两位小数');
});

it('keeps the server field error visible with the original value', () => {
  render(<LoyaltyTextInput name="amount" label="金额" value="90071992547409.93" onChange={() => undefined} parse={parseLoyaltyMoney} serverError="该券被启用来源引用" />);
  expect(screen.getByRole('textbox', { name: '金额' })).toHaveValue('90071992547409.93');
  expect(screen.getByRole('alert')).toHaveTextContent('该券被启用来源引用');
});
