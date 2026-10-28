import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { defaultConfigValues } from '../../shared/services/createIntegratedAdminServices';
import { TypedConfigurationFields } from './TypedConfigurationFields';
import { validConfigurationDraft } from './configurationDraft';

afterEach(cleanup);

function MaterialFields({ disabled = false, onChange }: { disabled?: boolean; onChange: (values: typeof defaultConfigValues) => void }) {
  const [values, setValues] = useState(() => structuredClone(defaultConfigValues));
  return <TypedConfigurationFields selectedKey="material.upload_policy" values={values} onChange={(next) => { setValues(next); onChange(next); }} disabled={disabled} />;
}

describe('typed configuration draft', () => {
  it('edits a typed field and keeps mandatory scanning', () => {
    const onChange = vi.fn();
    render(<TypedConfigurationFields selectedKey="material.upload_policy" values={structuredClone(defaultConfigValues)} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByLabelText('单文件上限（字节）'), { target: { value: '1024' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ 'material.upload_policy': expect.objectContaining({ max_bytes: 1024, scan_required: true }) }));
    expect(screen.getByLabelText('单文件上限（字节）')).toHaveAttribute('aria-valuemax', '104857600');
    expect(screen.queryByRole('checkbox', { name: /扫描/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('下载授权有效秒数')).not.toBeInTheDocument();
    const uploadTTL = screen.getByLabelText('上传授权有效秒数');
    expect(uploadTTL).toHaveDisplayValue('300');
    expect(uploadTTL).toHaveAttribute('aria-valuemin', '30');
    expect(uploadTTL).toHaveAttribute('aria-valuemax', '900');
  });
  it('enables and removes a current video class together with its limit and global MIME', () => {
    const onChange = vi.fn();
    render(<MaterialFields onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('单文件上限（字节）'), { target: { value: '104857600' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'CATALOG_VIDEO' }));
    let values = onChange.mock.calls.at(-1)?.[0] as typeof defaultConfigValues;
    expect(values['material.upload_policy']).toMatchObject({ allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] });
    expect(values['material.upload_policy'].class_limits.at(-1)).toEqual({ class: 'CATALOG_VIDEO', mimes: ['video/mp4'], max_bytes: 100000000, processing_required: false });
    expect(screen.getByLabelText('CATALOG_VIDEO 单文件上限（字节）')).toHaveAttribute('aria-valuemax', '100000000');
    expect(screen.queryByLabelText('证据视频最大时长（毫秒）')).not.toBeInTheDocument();
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'CATALOG_VIDEO' }));
    values = onChange.mock.calls.at(-1)?.[0] as typeof defaultConfigValues;
    expect(values['material.upload_policy'].allowed_classes).not.toContain('CATALOG_VIDEO');
    expect(values['material.upload_policy'].class_limits).toHaveLength(7);
    expect(values['material.upload_policy'].allowed_mime_types).not.toContain('video/mp4');
  });
  it('edits evidence duration and constrains icon formats without opening inactive provider consumers', () => {
    const onChange = vi.fn();
    render(<MaterialFields onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('单文件上限（字节）'), { target: { value: '104857600' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'EVIDENCE_VIDEO' }));
    fireEvent.change(screen.getByLabelText('证据视频最大时长（毫秒）'), { target: { value: '5000' } });
    let values = onChange.mock.calls.at(-1)?.[0] as typeof defaultConfigValues;
    expect(values['material.upload_policy'].class_limits.at(-1)).toEqual({ class: 'EVIDENCE_VIDEO', mimes: ['video/mp4'], max_bytes: 104857600, processing_required: true, max_duration_ms: 5000 });
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'SYSTEM_ICON' }));
    values = onChange.mock.calls.at(-1)?.[0] as typeof defaultConfigValues;
    expect(values['material.upload_policy'].class_limits.at(-1)).toEqual({ class: 'SYSTEM_ICON', mimes: ['image/png', 'image/webp'], max_bytes: 10485760, processing_required: false });
    expect(screen.queryByRole('checkbox', { name: 'CONTRACT_DOCUMENT' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'PROVIDER_PAYLOAD' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'RECONCILIATION_BILL' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /处理/ })).not.toBeInTheDocument();
  });
  it('offers PNG-only handwriting and restores its 2MiB limit when re-enabled', () => {
    const onChange = vi.fn();
    render(<MaterialFields onChange={onChange} />);
    const signature = screen.getByRole('checkbox', { name: 'CONTRACT_SIGNATURE_IMAGE' });
    expect(signature).toBeChecked();
    expect(screen.getByLabelText('CONTRACT_SIGNATURE_IMAGE 单文件上限（字节）')).toHaveAttribute('aria-valuemax', '2097152');
    const formats = screen.getByRole('group', { name: 'CONTRACT_SIGNATURE_IMAGE 格式（至少选择一项）' });
    expect(formats).toHaveTextContent('image/png');
    expect(formats).not.toHaveTextContent('image/jpeg');
    expect(formats).not.toHaveTextContent('image/webp');
    fireEvent.click(signature);
    expect(screen.queryByLabelText('CONTRACT_SIGNATURE_IMAGE 单文件上限（字节）')).not.toBeInTheDocument();
    fireEvent.click(signature);
    const values = onChange.mock.calls.at(-1)?.[0] as typeof defaultConfigValues;
    expect(values['material.upload_policy'].class_limits.at(-1)).toEqual({ class: 'CONTRACT_SIGNATURE_IMAGE', mimes: ['image/png'], max_bytes: 2097152, processing_required: false });
    expect(values['material.upload_policy'].allowed_classes).toContain('CHAT_IMAGE');
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(true);
  });
  it('disables every material class, MIME and limit without write permission', () => {
    render(<MaterialFields onChange={vi.fn()} disabled />);
    for (const input of screen.getAllByRole('spinbutton')) expect(input).toBeDisabled();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  });
  it('disables all editable controls without write permission', () => {
    render(<TypedConfigurationFields selectedKey="sms.challenge_policy" values={structuredClone(defaultConfigValues)} onChange={vi.fn()} disabled />);
    for (const input of screen.getAllByRole('spinbutton')) expect(input).toBeDisabled();
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  });
  it('rejects empty classes, invalid numbers, reversed nickname limits and cooldown exceeding TTL', () => {
    const values = structuredClone(defaultConfigValues);
    for (const key of ['material.upload_policy', 'identity.profile_policy', 'sms.challenge_policy'] as const) {
      expect(validConfigurationDraft(key, values)).toBe(true);
    }
    values['material.upload_policy'].allowed_classes = [];
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(false);
    values['material.upload_policy'].max_bytes = Number.NaN;
    expect(validConfigurationDraft('material.upload_policy', values)).toBe(false);
    values['identity.profile_policy'].display_name_min_length = 64;
    values['identity.profile_policy'].display_name_max_length = 1;
    expect(validConfigurationDraft('identity.profile_policy', values)).toBe(false);
    values['sms.challenge_policy'].cooldown_seconds = 301;
    expect(validConfigurationDraft('sms.challenge_policy', values)).toBe(false);
  });
});
