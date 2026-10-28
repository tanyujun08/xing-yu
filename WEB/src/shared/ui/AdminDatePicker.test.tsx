import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AdminDatePicker } from './AdminDatePicker';

afterEach(cleanup);

it.each([
  ['date', '2026-10-06', '2026-10-07', '2026-10-07'],
  ['month', '2026-10', '2026-11', '2026-11'],
  ['datetime-local', '2026-10-06T08:30', '2026-10-07 09:45', '2026-10-07T09:45'],
] as const)('keeps real editable text with the %s calendar open and commits or clears explicitly', (type, initial, typed, committed) => {
  const changed = vi.fn();
  function Field() {
    const [value, setValue] = useState<string>(initial);
    return <AdminDatePicker type={type} value={value} aria-label="日期筛选" onChange={(next) => { changed(next); setValue(next); }} />;
  }
  render(<Field />);
  const input = screen.getByRole('textbox', { name: '日期筛选' });
  fireEvent.mouseDown(input);
  expect(input).toHaveValue(initial.replace('T', ' '));
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(changed).toHaveBeenLastCalledWith(initial);
  fireEvent.mouseDown(input);
  fireEvent.input(input, { target: { value: typed } });
  expect(input).toHaveValue(typed);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(changed).toHaveBeenLastCalledWith(committed);
  expect(input).toHaveValue(typed);
  fireEvent.mouseDown(input);
  fireEvent.input(input, { target: { value: '' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(changed).toHaveBeenLastCalledWith('');
  expect(input).toHaveValue('');
});
