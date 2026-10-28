import { describe, expect, it } from 'vitest';
import type { MaterialFileResult } from '../services/contracts';
import { createMaterialUploadIntent, publicMaterialUrl, readyMaterialValue, restoreMaterialUploadIntent } from './materialUploadIntent';

describe('mounted material upload intent', () => {
  it('keeps the original file and key for an explicit recovery', () => {
    const file = new File(['original'], 'a.png', { type: 'image/png' });
    const intent = createMaterialUploadIntent('owner', file, 'CATALOG_IMAGE', 'stable-original-key');
    expect(restoreMaterialUploadIntent(intent, 'owner', file, 'CATALOG_IMAGE')).toBe(intent);
    expect(intent.file).toBe(file);
    expect(intent.key).toBe('stable-original-key');
  });

  it('rejects another account, another file object or another class', () => {
    const file = new File(['original'], 'a.png', { type: 'image/png' });
    const intent = createMaterialUploadIntent('owner', file, 'CATALOG_IMAGE');
    expect(() => restoreMaterialUploadIntent(intent, 'other', file, 'CATALOG_IMAGE')).toThrow('原账户');
    expect(() => restoreMaterialUploadIntent(intent, 'owner', new File(['original'], 'a.png', { type: 'image/png' }), 'CATALOG_IMAGE')).toThrow('原文件');
    expect(() => restoreMaterialUploadIntent(intent, 'owner', file, 'MERCHANT_IMAGE')).toThrow('素材类型');
    expect(() => createMaterialUploadIntent('', file, 'CATALOG_IMAGE')).toThrow();
  });

  it('accepts only a permanent HTTPS address on the configured original origin', () => {
    const origin = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com';
    expect(publicMaterialUrl(`${origin}/materials/original.png`, origin)).toBe(`${origin}/materials/original.png`);
    expect(publicMaterialUrl(null, origin)).toBeNull();
    for (const url of [`${origin}/x?signature=old`, `${origin}/x#fragment`, `${origin}/`, 'https://other.example.test/x', 'https://owner@xyuprj.oss-cn-hangzhou.aliyuncs.com/x', 'http://xyuprj.oss-cn-hangzhou.aliyuncs.com/x', ` ${origin}/x`, 'data:image/png;base64,abc']) {
      expect(() => publicMaterialUrl(url, origin)).toThrow('固定公开来源');
    }
    expect(() => publicMaterialUrl(`${origin}/x`, '')).toThrow('固定公开来源');
  });
});
describe('generated READY video receipt', () => {
  const origin = 'https://xyuprj.oss-cn-hangzhou.aliyuncs.com';
  const video: MaterialFileResult = { material_id: 'original-video', upload_id: 'original-upload', status: 'READY', public_url: origin + '/original.mp4', playback_url: origin + '/playback.mp4', mime_type: 'video/mp4', size_bytes: 3, metadata: { schema_version: 1, width: 1920, height: 1080, duration_ms: 1500, video_codec: 'h264', audio_codec: 'aac' }, poster: { material_id: 'own-poster', url: origin + '/poster.png', width: 640, height: 360 } };
  it('retains the original video ID and generated metadata and poster', () => {
    expect(readyMaterialValue(video, 'CATALOG_VIDEO', origin)).toMatchObject({ material_id: video.material_id, metadata: video.metadata, poster: video.poster, playback_url: video.playback_url });
  });
  it.each(['metadata', 'poster'] as const)('rejects null %s on a READY video', (missing) => {
    expect(() => readyMaterialValue({ ...video, [missing]: null }, 'CATALOG_VIDEO', origin)).toThrow(missing === 'metadata' ? '元数据' : '自身海报');
  });
  it('rejects invalid generated dimensions and a foreign poster origin', () => {
    expect(() => readyMaterialValue({ ...video, metadata: { ...video.metadata!, width: 0 } }, 'CATALOG_VIDEO', origin)).toThrow('元数据');
    expect(() => readyMaterialValue({ ...video, poster: { ...video.poster!, url: 'https://other.example.test/poster.png' } }, 'CATALOG_VIDEO', origin)).toThrow('固定公开来源');
  });
  it('requires a positive real duration and video codec but accepts a silent video', () => {
    expect(() => readyMaterialValue({ ...video, metadata: { ...video.metadata!, duration_ms: null } }, 'CATALOG_VIDEO', origin)).toThrow('元数据');
    for (const video_codec of [null, '', '   ']) expect(() => readyMaterialValue({ ...video, metadata: { ...video.metadata!, video_codec } }, 'CATALOG_VIDEO', origin)).toThrow('元数据');
    expect(readyMaterialValue({ ...video, metadata: { ...video.metadata!, audio_codec: null } }, 'CATALOG_VIDEO', origin).metadata?.audio_codec).toBeNull();
  });
});
