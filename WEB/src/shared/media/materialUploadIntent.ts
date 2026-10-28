import { randomId } from '../randomId';
import type { components } from '../api/generated/schema';
import type { Material, MaterialFileResult, ReadyMaterialValue } from '../services/contracts';

export interface MaterialUploadIntent {
  readonly owner: string;
  readonly file: File;
  readonly materialClass: components['schemas']['MaterialClass'];
  readonly key: string;
}

// File objects stay in this mounted form only. A recovery always sends the
// original bytes and key; selecting another file starts a separate intent.
export function createMaterialUploadIntent(owner: string, file: File, materialClass: MaterialUploadIntent['materialClass'], key: string = randomId()): MaterialUploadIntent {
  if (owner.trim() === '' || key.trim() === '') throw new Error('上传账户或原请求标识不可用');
  return Object.freeze({ owner, file, materialClass, key });
}

export function restoreMaterialUploadIntent(intent: MaterialUploadIntent, owner: string, file: File, materialClass: MaterialUploadIntent['materialClass']): MaterialUploadIntent {
  if (intent.owner !== owner || intent.file !== file || intent.materialClass !== materialClass) {
    throw new Error('只能由原账户恢复原文件和原素材类型的上传');
  }
  return intent;
}

export function publicMaterialUrl(value: string | null, origin: string): string | null {
  if (value === null) return null;
  // The independent visual preview uses only in-tab uploads and bundled assets.
  if (value.startsWith('blob:') || value.startsWith('/assets/')) return value;
  if (/^http:\/\/127\.0\.0\.1:5190\/__mock-link\/materials\/local-material-[A-Za-z0-9-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (origin !== '' && value === value.trim() && url.protocol === 'https:' && url.origin === origin && url.username === '' && url.password === '' && url.search === '' && url.hash === '' && url.pathname !== '/') return value;
  } catch { /* Show the same bounded invalid-source state as a rejected origin. */ }
  throw new Error('素材地址与固定公开来源不一致');
}

export function readyMaterialValue(material: Material | MaterialFileResult, materialClass: MaterialUploadIntent['materialClass'], origin: string): ReadyMaterialValue {
  const video = materialClass.endsWith('_VIDEO');
  if (material.status !== 'READY' || !material.material_id || material.material_id.length > 64 || ('material_class' in material && material.material_class !== materialClass) || !Number.isSafeInteger(material.size_bytes) || material.size_bytes <= 0 || material.size_bytes > 104_857_600 || !material.mime_type.startsWith(video ? 'video/' : 'image/')) throw new Error('服务端素材尚未就绪或回读内容不一致');
  const public_url = publicMaterialUrl(material.public_url, origin);
  const playback_url = publicMaterialUrl(material.playback_url, origin);
  if (public_url === null || (video ? playback_url === null : playback_url !== null)) throw new Error('素材公开地址或视频播放地址尚未就绪');
  const metadata = material.metadata;
  if ((video && (metadata === null || metadata.duration_ms === null || metadata.video_codec === null || metadata.video_codec.trim() === '')) || (metadata !== null && (!metadata || metadata.schema_version !== 1 || !Number.isInteger(metadata.width) || metadata.width <= 0 || metadata.width > 8192 || !Number.isInteger(metadata.height) || metadata.height <= 0 || metadata.height > 8192 || (metadata.duration_ms !== null && (!Number.isInteger(metadata.duration_ms) || metadata.duration_ms <= 0 || metadata.duration_ms > 4294967295))))) throw new Error('素材元数据不完整');
  const poster = material.poster;
  if ((video && poster === null) || (poster !== null && (!poster || !video || !poster.material_id || !Number.isInteger(poster.width) || poster.width <= 0 || poster.width > 1280 || !Number.isInteger(poster.height) || poster.height <= 0 || poster.height > 1280 || publicMaterialUrl(poster.url, origin) === null))) throw new Error('视频自身海报不完整');
  return { material_id: material.material_id, material_class: materialClass, public_url, playback_url, mime_type: material.mime_type, size_bytes: material.size_bytes, metadata, poster };
}
