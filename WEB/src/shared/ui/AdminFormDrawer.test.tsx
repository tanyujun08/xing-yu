import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form, Input } from 'tdesign-react';
import { afterEach, expect, test, vi } from 'vitest';
import { AdminFormDrawer, type AdminFormDrawerSize } from './AdminFormDrawer';

afterEach(cleanup);

interface FixtureProps {
  onSubmit?: () => void | Promise<void>;
  onCancel?: () => void;
  size?: AdminFormDrawerSize | undefined;
  pending?: boolean | undefined;
  submitBlocked?: boolean | undefined;
  dirty?: boolean | undefined;
  errorSummary?: string | undefined;
}

function FormFixture({
  onSubmit = () => undefined,
  onCancel = () => undefined,
  size,
  pending,
  submitBlocked,
  dirty,
  errorSummary,
}: FixtureProps) {
  const [name, setName] = useState('');
  const form = Form.useForm()[0]!;

  return (
    <AdminFormDrawer
      visible
      title="新增测试记录"
      description="填写后保存到当前 Mock 工作区。"
      confirmText="保存记录"
      form={form}
      values={{ name }}
      size={size}
      pending={pending}
      submitBlocked={submitBlocked}
      dirty={dirty ?? name !== ''}
      errorSummary={errorSummary}
      onCancel={onCancel}
      onSubmit={onSubmit}
    >
      <Form.FormItem name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }]}>
        <Input value={name} placeholder="请输入名称" onChange={setName} />
      </Form.FormItem>
    </AdminFormDrawer>
  );
}

test('blocks save during material processing while allowing cancellation', async () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<FormFixture submitBlocked dirty={false} onSubmit={onSubmit} onCancel={onCancel} />);
  expect(await screen.findByRole('button', { name: '保存记录' })).toBeDisabled();
  const cancel = screen.getByRole('button', { name: '取消' });
  expect(cancel).toBeEnabled();
  fireEvent.click(cancel);
  expect(onCancel).toHaveBeenCalledOnce();
  expect(onSubmit).not.toHaveBeenCalled();
});

test('uses the locked drawer sizes and focuses the first editable control', async () => {
  const { unmount } = render(<FormFixture />);

  expect(await screen.findByRole('heading', { name: '新增测试记录' })).toBeInTheDocument();
  expect(screen.getByText('填写后保存到当前 Mock 工作区。')).toBeInTheDocument();
  const compactPanel = document.querySelector<HTMLElement>('.admin-form-drawer .t-drawer__content-wrapper');
  expect(compactPanel).not.toBeNull();
  expect(compactPanel?.style.width).toBe('var(--xy-admin-form-drawer-width-compact)');
  await waitFor(() => expect(compactPanel).toHaveAttribute('role', 'dialog'));
  await waitFor(() => expect(screen.getByPlaceholderText('请输入名称')).toHaveFocus());

  unmount();
  render(<FormFixture size="complex" />);
  const complexPanel = await waitFor(() => {
    const panel = document.querySelector<HTMLElement>('.admin-form-drawer .t-drawer__content-wrapper');
    expect(panel).not.toBeNull();
    return panel!;
  });
  expect(complexPanel.style.width).toBe('var(--xy-admin-form-drawer-width-complex)');
});

test('announces validation errors and locks duplicate asynchronous submissions', async () => {
  let resolveSubmit: (() => void) | undefined;
  const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
    resolveSubmit = resolve;
  }));
  render(<FormFixture onSubmit={onSubmit} />);

  const saveButton = await screen.findByRole('button', { name: '保存记录' });
  fireEvent.click(saveButton);

  expect(await screen.findByText('请检查以下内容')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('请输入名称');
  expect(onSubmit).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByPlaceholderText('请输入名称')).toHaveFocus());

  fireEvent.change(screen.getByPlaceholderText('请输入名称'), { target: { value: '演示记录' } });
  fireEvent.click(saveButton);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: '保存记录' })).toBeDisabled());

  fireEvent.click(screen.getByRole('button', { name: '保存记录' }));
  expect(onSubmit).toHaveBeenCalledTimes(1);
  resolveSubmit?.();
  await waitFor(() => expect(screen.getByRole('button', { name: '保存记录' })).not.toBeDisabled());
});

test('routes dirty cancel, overlay, and Escape attempts through discard confirmation', async () => {
  const onCancel = vi.fn();
  render(<FormFixture dirty onCancel={onCancel} />);

  fireEvent.click(await screen.findByRole('button', { name: '取消' }));
  expect(await screen.findByText('放弃未保存的修改？')).toBeInTheDocument();
  expect(onCancel).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '继续编辑' })).not.toBeInTheDocument());

  const mask = document.querySelector<HTMLElement>('.admin-form-drawer .t-drawer__mask');
  expect(mask).not.toBeNull();
  fireEvent.click(mask!);
  expect(await screen.findByText('放弃未保存的修改？')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '继续编辑' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: '继续编辑' })).not.toBeInTheDocument());
  const drawer = document.querySelector<HTMLElement>('.admin-form-drawer');
  expect(drawer).not.toBeNull();
  fireEvent.keyDown(drawer!, { key: 'Escape' });
  expect(await screen.findByText('放弃未保存的修改？')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '放弃修改' }));
  await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
});

test('keeps pending drawers closed to exit attempts and exposes external errors', async () => {
  const onCancel = vi.fn();
  render(<FormFixture pending errorSummary="服务暂时不可用，请稍后再试。" onCancel={onCancel} />);

  expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用，请稍后再试。');
  const cancelButton = screen.getByRole('button', { name: '取消' });
  const closeButton = screen.getByRole('button', { name: '关闭' });
  expect(cancelButton).toBeDisabled();
  expect(closeButton).toBeDisabled();

  fireEvent.click(cancelButton);
  fireEvent.click(closeButton);
  const mask = document.querySelector<HTMLElement>('.admin-form-drawer .t-drawer__mask');
  const drawer = document.querySelector<HTMLElement>('.admin-form-drawer');
  fireEvent.click(mask!);
  fireEvent.keyDown(drawer!, { key: 'Escape' });
  expect(onCancel).not.toHaveBeenCalled();
  expect(screen.queryByText('放弃未保存的修改？')).not.toBeInTheDocument();
});

test('contains keyboard focus and restores the opener after a clean cancel', async () => {
  function OpenFixture() {
    const [visible, setVisible] = useState(false);
    const form = Form.useForm()[0]!;
    return (
      <>
        <button type="button" onClick={() => setVisible(true)}>打开录入</button>
        <AdminFormDrawer
          visible={visible}
          title="编辑记录"
          confirmText="保存记录"
          form={form}
          values={{ name: '' }}
          onCancel={() => setVisible(false)}
          onSubmit={() => undefined}
        >
          <Form.FormItem name="name" label="名称">
            <Input placeholder="档案名称" />
          </Form.FormItem>
        </AdminFormDrawer>
      </>
    );
  }

  render(<OpenFixture />);
  const opener = screen.getByRole('button', { name: '打开录入' });
  opener.focus();
  fireEvent.click(opener);
  await waitFor(() => expect(screen.getByPlaceholderText('档案名称')).toHaveFocus());

  const saveButton = screen.getByRole('button', { name: '保存记录' });
  saveButton.focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: '关闭' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  await waitFor(() => expect(opener).toHaveFocus());
});
