import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiProblem } from '../api/problem';
import type { Material, MaterialFileResult } from '../services/contracts';
import type { StagedMediaFile } from '../media/demoMedia';
import { MediaUploadField } from './MediaUploadField';

const fixture = vi.hoisted(() => ({
  enabled: true, onChange: vi.fn(), onState: vi.fn(),
  services: { materials: { uploadFile: vi.fn(), get: vi.fn() } },
}));
const origin = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com';
vi.mock('../config/env', () => ({ get apiIntegrationEnabled() { return fixture.enabled; }, publicEnv: { materialPublicOrigin: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com' } }));
vi.mock('../services/useAdminServices', () => ({ useAdminServices: () => fixture.services }));
const ready: MaterialFileResult = {
  material_id: 'original-image', upload_id: 'original-upload', status: 'READY', public_url: origin + '/original.png',
  playback_url: null, mime_type: 'image/png', size_bytes: 3, metadata: { schema_version: 1, width: 2, height: 2, duration_ms: null, video_codec: null, audio_codec: null }, poster: null,
};
const material: Material = {
  ...ready, material_class: 'CATALOG_IMAGE', owner_account_id: 'owner', scope_type: 'ACCOUNT',
  expected_mime: 'image/png', expected_size: 3, expected_sha256: 'a'.repeat(64), sse_mode: 'SSE-OSS', version: 1,
  created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
function Harness({ owner = 'owner', active = true, video = false, max }: { owner?: string; active?: boolean; video?: boolean; max?: number }) {
  const [value, setValue] = useState<StagedMediaFile[]>([]);
  return <MediaUploadField kind={video ? 'video' : 'image'} label="测试素材" {...(max === undefined ? {} : { max })} value={value} ownerId={owner} active={active} materialClass={video ? 'CATALOG_VIDEO' : 'CATALOG_IMAGE'} onStateChange={fixture.onState} onChange={(items) => { fixture.onChange(items); setValue(items); }} />;
}
function choose(type = 'image/png', size = 3) {
  const file = new File(['png'], 'original.png', { type });
  Object.defineProperty(file, 'size', { value: size });
  fireEvent.change(screen.getByLabelText('测试素材文件选择'), { target: { files: [file] } });
  return file;
}
beforeEach(() => { vi.resetAllMocks(); fixture.enabled = true; fixture.services.materials.uploadFile.mockResolvedValue(ready); fixture.services.materials.get.mockResolvedValue(material); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('first-party material files', () => {
  it('automatically fills only the original READY material ID and generated public values', async () => {
    render(<Harness />);
    const file = choose();
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    const [submitted, materialClass, key, context] = fixture.services.materials.uploadFile.mock.calls[0]!;
    expect(submitted).toBe(file); expect(materialClass).toBe('CATALOG_IMAGE'); expect(key).toBeTruthy(); expect(context.signal).toBeInstanceOf(AbortSignal);
    expect(fixture.onChange.mock.calls[0]![0][0]).toMatchObject({ materialId: 'original-image', dataUrl: ready.public_url, material: { material_id: 'original-image', metadata: ready.metadata } });
    expect(fixture.services.materials.get).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '确认已上传对象' })).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', ready.public_url);
  });
  it('polls the same ID after 202 without another POST and blocks save before READY', async () => {
    vi.useFakeTimers();
    fixture.services.materials.uploadFile.mockResolvedValue({ ...ready, status: 'SCANNING', public_url: null, metadata: null });
    render(<Harness />);
    await act(async () => { choose(); await Promise.resolve(); });
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.onState).toHaveBeenCalledWith(expect.objectContaining({ pending: true, blocked: true }));
    expect(screen.getByRole('status')).toHaveTextContent('处理中 · original-image');
    expect(screen.queryByRole('button', { name: '查询状态' })).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fixture.services.materials.get).toHaveBeenCalledExactlyOnceWith('original-image', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
    expect(fixture.onChange).toHaveBeenCalledOnce();
  });
  it('requires explicit recovery with the original File, class and key after an unknown result', async () => {
    fixture.services.materials.uploadFile.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: '原上传超时', request_id: 'timeout' })).mockResolvedValueOnce(ready);
    render(<Harness />); const file = choose();
    const restore = await screen.findByRole('button', { name: '恢复原上传' });
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.onState).toHaveBeenCalledWith(expect.objectContaining({ unknown: true, blocked: true }));
    fireEvent.click(restore);
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    const calls = fixture.services.materials.uploadFile.mock.calls;
    expect(calls[1]!.slice(0, 3)).toEqual(calls[0]!.slice(0, 3));
    expect(calls[1]![0]).toBe(file);
  });
  it('ends an upload intent only after explicit server expiry and explicit user action', async () => {
    fixture.services.materials.uploadFile.mockRejectedValueOnce(new ApiProblem(412, { code: 'MATERIAL_UPLOAD_EXPIRED', message: '原上传已过期', request_id: 'expired' })).mockResolvedValueOnce(ready);
    render(<Harness />); const file = choose();
    const end = await screen.findByRole('button', { name: '结束已过期上传' });
    expect(screen.getByRole('status')).toHaveTextContent('上传已过期');
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
    expect(fixture.services.materials.get).not.toHaveBeenCalled();
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ failed: true, blocked: true }));
    expect(screen.queryByRole('button', { name: '恢复原上传' })).not.toBeInTheDocument();
    fireEvent.click(end);
    await waitFor(() => expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: false })));
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText('测试素材文件选择'), { target: { files: [file] } });
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    const calls = fixture.services.materials.uploadFile.mock.calls;
    expect(calls[1]![0]).toBe(file); expect(calls[1]![1]).toBe(calls[0]![1]); expect(calls[1]![2]).not.toBe(calls[0]![2]);
  });
  it('keeps a no-ID general 412 unknown and recovers only the original file and key', async () => {
    fixture.services.materials.uploadFile.mockRejectedValueOnce(new ApiProblem(412, { code: 'PRECONDITION_FAILED', message: '一般前置条件失败', request_id: 'precondition' })).mockResolvedValueOnce(ready);
    render(<Harness />); const file = choose();
    const restore = await screen.findByRole('button', { name: '恢复原上传' });
    expect(screen.queryByRole('button', { name: '结束已过期上传' })).not.toBeInTheDocument();
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(fixture.onState).toHaveBeenLastCalledWith({ pending: false, failed: false, unknown: true, blocked: true });
      expect(restore).toBeEnabled();
    });
    fireEvent.click(restore);
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    const calls = fixture.services.materials.uploadFile.mock.calls;
    expect(calls[1]!.slice(0, 3)).toEqual(calls[0]!.slice(0, 3)); expect(calls[1]![0]).toBe(file);
  });
  it.each(['MATERIAL_UPLOAD_EXPIRED', 'PRECONDITION_FAILED'] as const)('preserves an existing ID and queries it without another POST after %s', async (code) => {
    vi.useFakeTimers();
    fixture.services.materials.uploadFile.mockResolvedValue({ ...ready, status: 'PROCESSING', public_url: null, metadata: null });
    fixture.services.materials.get.mockRejectedValueOnce(new ApiProblem(412, { code, message: '原素材查询未完成', request_id: 'query' })).mockRejectedValueOnce(new ApiProblem(412, { code: 'PRECONDITION_FAILED', message: '再次查询失败', request_id: 'query-again' }));
    render(<Harness />);
    await act(async () => { choose(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByRole('status')).toHaveTextContent('original-image');
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '恢复原上传' })).not.toBeInTheDocument();
    expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true }));
    expect(screen.getByRole('button', { name: '查询状态' })).toBeEnabled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '查询状态' })); await Promise.resolve(); });
    expect(fixture.services.materials.get).toHaveBeenCalledTimes(2);
    expect(fixture.services.materials.get.mock.calls.map((call) => call[0])).toEqual(['original-image', 'original-image']);
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('original-image');
    expect(screen.queryByRole('button', { name: '结束已过期上传' }) !== null).toBe(code === 'MATERIAL_UPLOAD_EXPIRED');
    expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true }));
  });
  it('cancels waiting and rejects a late READY response without clearing the original recovery intent', async () => {
    let complete!: (value: MaterialFileResult) => void;
    fixture.services.materials.uploadFile.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    render(<Harness />); choose();
    fireEvent.click(await screen.findByRole('button', { name: '取消上传或查询' }));
    expect(fixture.services.materials.uploadFile.mock.calls[0]![3].signal.aborted).toBe(true);
    await act(async () => complete(ready));
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: '恢复原上传' })).toBeEnabled();
  });
  it.each(['owner', 'active', 'unmount'] as const)('isolates a late upload after %s changes', async (boundary) => {
    let complete!: (value: MaterialFileResult) => void;
    fixture.services.materials.uploadFile.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const view = render(<Harness />); choose();
    await screen.findByRole('button', { name: '取消上传或查询' });
    if (boundary === 'unmount') view.unmount();
    else view.rerender(<Harness owner={boundary === 'owner' ? 'different-owner' : 'owner'} active={boundary !== 'active'} />);
    await act(async () => complete(ready));
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
    expect(fixture.services.materials.uploadFile.mock.calls[0]![3].signal.aborted).toBe(true);
  });
  it('keeps a mismatched same-ID query blocked and never emits a wrong material', async () => {
    vi.useFakeTimers();
    fixture.services.materials.uploadFile.mockResolvedValue({ ...ready, status: 'PROCESSING', public_url: null });
    fixture.services.materials.get.mockResolvedValue({ ...material, material_id: 'wrong-id' });
    render(<Harness />);
    await act(async () => { choose(); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.services.materials.get).toHaveBeenCalledOnce();
    expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true }));
  });
  it('keeps the server rejection text and blocks save until the failed item is removed', async () => {
    fixture.services.materials.uploadFile.mockRejectedValue(new ApiProblem(422, { code: 'VALIDATION_FAILED', message: '服务端真实格式拒绝原因', request_id: 'validation' }));
    render(<Harness />); choose();
    await screen.findByText('服务端真实格式拒绝原因');
    expect(fixture.onState).toHaveBeenCalledWith(expect.objectContaining({ failed: true, blocked: true }));
    expect(screen.queryByRole('button', { name: '恢复原上传' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '移除待办' }));
    await waitFor(() => expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: false })));
  });
  it('rejects a foreign or signed source before filling a business ID', async () => {
    fixture.services.materials.uploadFile.mockResolvedValue({ ...ready, public_url: ready.public_url + '?signature=old' });
    render(<Harness />); choose();
    await screen.findByText('素材地址与固定公开来源不一致');
    expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce();
  });
  it('validates MIME/image limits and the exact 100 MiB video ceiling before upload', async () => {
    const view = render(<Harness />); choose('image/svg+xml'); choose('image/png', 10 * 1024 * 1024 + 1);
    expect(fixture.services.materials.uploadFile).not.toHaveBeenCalled();
    view.rerender(<Harness video />); choose('video/mp4', 104_857_601);
    expect(fixture.services.materials.uploadFile).not.toHaveBeenCalled();
    choose('video/mp4', 104_857_600);
    await waitFor(() => expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce());
  });
  it('refuses an entire oversized selection while preserving completed files', async () => {
    render(<Harness max={2} />); choose();
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('测试素材文件选择'), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('还可上传 1 个文件，本次选择超额，整批未上传');
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onChange).toHaveBeenCalledOnce();
    expect(screen.getByRole('img', { name: '测试素材 1' })).toHaveAttribute('src', ready.public_url);
  });
  it('counts an unresolved original intent before refusing an oversized batch', async () => {
    fixture.services.materials.uploadFile.mockRejectedValueOnce(new ApiProblem(0, { code: 'REQUEST_TIMEOUT', message: '原上传超时', request_id: 'timeout' }));
    render(<Harness max={2} />); const original = choose();
    await screen.findByRole('button', { name: '恢复原上传' });
    fireEvent.change(screen.getByLabelText('测试素材文件选择'), { target: { files: [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('整批未上传');
    expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onChange).not.toHaveBeenCalled();
    expect(fixture.services.materials.uploadFile.mock.calls[0]![0]).toBe(original); expect(screen.getByRole('button', { name: '恢复原上传' })).toBeEnabled();
  });
  it('keeps a legal batch in its original selection order', async () => {
    fixture.services.materials.uploadFile.mockResolvedValueOnce(ready).mockResolvedValueOnce({ ...ready, material_id: 'second-image', public_url: origin + '/second.png' } satisfies MaterialFileResult);
    render(<Harness max={2} />);
    const files = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];
    fireEvent.change(screen.getByLabelText('测试素材文件选择'), { target: { files } });
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledTimes(2));
    expect(fixture.onChange.mock.lastCall![0].map((item: StagedMediaFile) => [item.materialId, item.name])).toEqual([['original-image', 'a.png'], ['second-image', 'b.png']]);
    expect(fixture.services.materials.uploadFile.mock.calls.map((call) => call[0])).toEqual(files);
  });
  it.each(['metadata', 'poster'] as const)('keeps a READY video with missing %s blocked on its original ID', async (missing) => {
    const video: MaterialFileResult = { ...ready, material_id: 'original-video', public_url: origin + '/original.mp4', playback_url: origin + '/playback.mp4', mime_type: 'video/mp4', metadata: { schema_version: 1, width: 1920, height: 1080, duration_ms: 1500, video_codec: 'h264', audio_codec: 'aac' }, poster: { material_id: 'own-poster', url: origin + '/poster.png', width: 640, height: 360 }, [missing]: null };
    fixture.services.materials.uploadFile.mockResolvedValue(video); render(<Harness video />); choose('video/mp4');
    await screen.findByText(missing === 'metadata' ? '素材元数据不完整' : '视频自身海报不完整');
    expect(fixture.onChange).not.toHaveBeenCalled(); expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.services.materials.get).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('original-video'); expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true }));
  });
  it('fills a READY video with its generated metadata and own poster', async () => {
    const video: MaterialFileResult = { ...ready, material_id: 'original-video', public_url: origin + '/original.mp4', playback_url: origin + '/playback.mp4', mime_type: 'video/mp4', metadata: { schema_version: 1, width: 1920, height: 1080, duration_ms: 1500, video_codec: 'h264', audio_codec: 'aac' }, poster: { material_id: 'own-poster', url: origin + '/poster.png', width: 640, height: 360 } };
    fixture.services.materials.uploadFile.mockResolvedValue(video); render(<Harness video />); choose('video/mp4');
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    expect(fixture.onChange.mock.lastCall![0][0]).toMatchObject({ materialId: 'original-video', material: { metadata: video.metadata, poster: video.poster, playback_url: video.playback_url } });
    expect(screen.getByText('1920 × 1080 · 1.5 秒')).toBeInTheDocument(); expect(fixture.services.materials.get).not.toHaveBeenCalled();
  });
  it.each(['duration', 'codec'] as const)('keeps READY video with incomplete %s metadata blocked', async (missing) => {
    const video: MaterialFileResult = { ...ready, material_id: 'original-video', public_url: origin + '/original.mp4', playback_url: origin + '/playback.mp4', mime_type: 'video/mp4', metadata: { schema_version: 1, width: 1920, height: 1080, duration_ms: missing === 'duration' ? null : 1500, video_codec: missing === 'codec' ? '' : 'h264', audio_codec: null }, poster: { material_id: 'own-poster', url: origin + '/poster.png', width: 640, height: 360 } };
    fixture.services.materials.uploadFile.mockResolvedValue(video); render(<Harness video />); choose('video/mp4'); await screen.findByText('素材元数据不完整');
    expect(fixture.onChange).not.toHaveBeenCalled(); expect(fixture.services.materials.uploadFile).toHaveBeenCalledOnce(); expect(fixture.onState).toHaveBeenLastCalledWith(expect.objectContaining({ blocked: true }));
  });
  it('keeps the demo file preview offline and never invents a real material ID', async () => {
    fixture.enabled = false; render(<Harness />); choose();
    await waitFor(() => expect(fixture.onChange).toHaveBeenCalledOnce());
    expect(fixture.onChange.mock.calls[0]![0][0].materialId).toBeUndefined();
    expect(fixture.services.materials.uploadFile).not.toHaveBeenCalled();
  });
});
