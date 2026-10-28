import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Material } from '../services/contracts';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaVideoPreview } from './MediaVideoPreview';
const fixture = vi.hoisted(() => ({ services: { materials: { get: vi.fn() } } }));
vi.mock('../config/env', () => ({ apiIntegrationEnabled: true, publicEnv: { materialPublicOrigin: 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com' } }));
vi.mock('../services/useAdminServices', () => ({ useAdminServices: () => fixture.services }));
const origin = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com';
const image: Material = {
  material_id: 'original-image', material_class: 'CATALOG_IMAGE', owner_account_id: 'owner', scope_type: 'ACCOUNT', status: 'READY',
  public_url: origin + '/original.png', playback_url: null, mime_type: 'image/png', size_bytes: 3,
  metadata: { schema_version: 1, width: 2, height: 2, duration_ms: null, video_codec: null, audio_codec: null }, poster: null,
  expected_mime: 'image/png', expected_size: 3, expected_sha256: 'a'.repeat(64), sse_mode: 'SSE-OSS', version: 1,
  created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z',
};
const video: Material = { ...image, material_id: 'original-video', material_class: 'CATALOG_VIDEO', mime_type: 'video/mp4', public_url: origin + '/original.mp4', playback_url: origin + '/verified-playback.mp4', metadata: { schema_version: 1, width: 1920, height: 1080, duration_ms: 1500, video_codec: 'h264', audio_codec: 'aac' }, poster: { material_id: 'own-poster', url: origin + '/own-poster.png', width: 640, height: 360 } };
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);
describe('permanent material display', () => {
  it('reloads the same image address after a network failure without another metadata read', async () => {
    fixture.services.materials.get.mockResolvedValue(image);
    render(<MediaThumbnail mediaRef={image.material_id} alt="原图片" />);
    const img = await screen.findByRole('img', { name: '原图片' });
    expect(img).toHaveAttribute('src', image.public_url);
    fireEvent.error(img);
    fireEvent.click(screen.getByRole('button', { name: '重新加载原图片' }));
    expect(screen.getByRole('img', { name: '原图片' })).toHaveAttribute('src', image.public_url);
    expect(fixture.services.materials.get).toHaveBeenCalledOnce();
  });
  it('opens the permanent original image, reloads the same source and restores trigger focus', async () => {
    fixture.services.materials.get.mockResolvedValue(image);
    const parentNavigation = vi.fn(); render(<div onClick={parentNavigation}><MediaThumbnail mediaRef={image.material_id} alt="原图片" /></div>);
    const trigger = await screen.findByRole('button', { name: '查看原图片大图' }); trigger.focus(); fireEvent.click(trigger);
    expect(parentNavigation).not.toHaveBeenCalled();
    const large = await screen.findByRole('img', { name: '原图片大图' }); expect(large).toHaveAttribute('src', image.public_url);
    fireEvent.error(large); fireEvent.click(screen.getByRole('button', { name: '重新加载原地址' }));
    expect(screen.getByRole('img', { name: '原图片大图' })).toHaveAttribute('src', image.public_url); expect(fixture.services.materials.get).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => expect(trigger).toHaveFocus()); expect(screen.getByRole('img', { name: '原图片' })).toHaveAttribute('src', image.public_url);
  });
  it('plays a verified video with its own poster and metadata; errors reload that same URL', async () => {
    fixture.services.materials.get.mockResolvedValue(video);
    render(<MediaVideoPreview mediaRef={video.material_id} label="播放设备视频" />);
    fireEvent.click(await screen.findByRole('button', { name: /播放设备视频/ }));
    await waitFor(() => expect(document.querySelector('video')).toHaveAttribute('src', video.playback_url));
    expect(document.querySelector('video')).toHaveAttribute('poster', video.poster!.url);
    expect(screen.getByText('1920 × 1080 · 1.5 秒')).toBeInTheDocument();
    fireEvent.error(document.querySelector('video')!);
    fireEvent.click(screen.getByRole('button', { name: '重新加载原地址' }));
    expect(document.querySelector('video')).toHaveAttribute('src', video.playback_url);
    expect(fixture.services.materials.get).toHaveBeenCalledOnce();
  });
  it('reloads only a failed own poster at the same permanent URL without another metadata read', async () => {
    fixture.services.materials.get.mockResolvedValue(video);
    render(<MediaVideoPreview mediaRef={video.material_id} label="播放设备视频" />);
    const poster = await screen.findByRole('img', { name: '播放设备视频自身海报' });
    expect(poster).toHaveAttribute('src', video.poster!.url);
    fireEvent.error(poster);
    expect(screen.getByRole('alert')).toHaveTextContent('视频海报加载失败');
    fireEvent.click(screen.getByRole('button', { name: '重新加载原海报' }));
    const reloaded = screen.getByRole('img', { name: '播放设备视频自身海报' });
    expect(reloaded).not.toBe(poster); expect(reloaded).toHaveAttribute('src', video.poster!.url);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fixture.services.materials.get).toHaveBeenCalledExactlyOnceWith(video.material_id, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: /播放设备视频/ }));
    await waitFor(() => expect(document.querySelector('video')).toHaveAttribute('src', video.playback_url));
    expect(document.querySelector('video')).toHaveAttribute('poster', video.poster!.url);
    expect(fixture.services.materials.get).toHaveBeenCalledOnce();
  });
  it('rejects a different video ID or signed playback without a playable element', async () => {
    fixture.services.materials.get.mockResolvedValue({ ...video, material_id: 'different-video' });
    const view = render(<MediaVideoPreview mediaRef={video.material_id} label="播放设备视频" />);
    await screen.findByText('视频读取失败');
    expect(document.querySelector('video')).toBeNull();
    view.unmount();
    fixture.services.materials.get.mockResolvedValue({ ...video, playback_url: video.playback_url + '?signature=old' });
    render(<MediaVideoPreview mediaRef={video.material_id} label="播放设备视频" />);
    await screen.findByText('视频读取失败');
    expect(document.querySelector('video')).toBeNull();
  });
  it('aborts metadata on leave and ignores a late response', async () => {
    let complete!: (value: Material) => void;
    fixture.services.materials.get.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const view = render(<MediaVideoPreview mediaRef={video.material_id} label="播放设备视频" />);
    const signal = fixture.services.materials.get.mock.calls[0]![1].signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => complete(video));
    expect(document.querySelector('video')).toBeNull();
  });
});
