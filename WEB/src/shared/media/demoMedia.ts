import type { ReadyMaterialValue } from '../services/contracts';

const CAMERA_BODY_URL = '/assets/mock/device-camera-body.png';
const TELEPHOTO_LENS_URL = '/assets/mock/device-telephoto-lens.png';
const CAMERA_KIT_URL = '/assets/mock/device-camera-kit.png';

export function resolveMediaUrl(mediaRef: string | null | undefined): string | null {
  if (mediaRef === null || mediaRef === undefined || mediaRef.trim() === '') return null;
  if (/^(?:data:|blob:|https?:\/\/|\/)/i.test(mediaRef)) return mediaRef;
  if (mediaRef.startsWith('media_standard_1_') || mediaRef.startsWith('media_request_')) return CAMERA_BODY_URL;
  if (mediaRef.startsWith('media_standard_2_')) return TELEPHOTO_LENS_URL;
  if (mediaRef.startsWith('media_c2c_')) return CAMERA_KIT_URL;
  return CAMERA_BODY_URL;
}

export function mediaRefsFromUploads(files: readonly StagedMediaFile[], requireOriginal = false): string[] {
  if (requireOriginal && files.some((file) => !file.materialId)) throw new Error('业务素材必须使用服务端原素材 ID');
  return files.map((file) => file.materialId ?? file.dataUrl);
}

export interface StagedMediaFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  materialId?: string;
  material?: ReadyMaterialValue;
}

export function readMediaFile(file: File): Promise<StagedMediaFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error(`无法生成文件预览：${file.name}`));
        return;
      }
      resolve({
        id: `${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.readAsDataURL(file);
  });
}
