import { demoWx } from '../../preview/platform';
export type LocalMediaKind = 'image' | 'video' | 'mixed';

type MediaOperationValidity = () => boolean;

function bestEffortRemoveSavedFile(savedFilePath: string): void {
  try {
    const fileSystem = wx.getFileSystemManager();
    if (typeof fileSystem.removeSavedFile !== 'function') return;
    fileSystem.removeSavedFile({
      filePath: savedFilePath,
      fail: () => undefined,
    });
  } catch {
    // Cleanup must never surface a stale media operation back to its disposed page.
  }
}

function saveLocalFile(tempFilePath: string, isValid: MediaOperationValidity): Promise<{ path: string; persisted: boolean; cancelled?: boolean; reason?: string }> {
  return new Promise((resolve) => {
    if (!isValid()) {
      resolve({ path: tempFilePath, persisted: false, cancelled: true });
      return;
    }
    wx.getFileSystemManager().saveFile({
      tempFilePath,
      success: (result) => {
        if (isValid()) {
          resolve({ path: result.savedFilePath, persisted: true });
          return;
        }
        bestEffortRemoveSavedFile(result.savedFilePath);
        resolve({ path: result.savedFilePath, persisted: false, cancelled: true });
      },
      fail: (error) => resolve(isValid()
        ? { path: tempFilePath, persisted: false, reason: error.errMsg || '本地媒体保存失败' }
        : { path: tempFilePath, persisted: false, cancelled: true }),
    });
  });
}


export function chooseAndSaveMedia(
  kind: LocalMediaKind,
  count = 1,
  sourceType: Array<'album' | 'camera'> = ['album', 'camera'],
  isValid: MediaOperationValidity = () => true,
  validateFile?: (file: WechatMiniprogram.MediaFile) => void,
): Promise<string[]> {
  const mediaType: Array<'image' | 'video'> = kind === 'mixed' ? ['image', 'video'] : [kind];
  return new Promise((resolve, reject) => {
    if (!isValid()) {
      resolve([]);
      return;
    }
    demoWx.chooseMedia({
      count,
      mediaType,
      sourceType,
      success: (result) => {
        if (!isValid()) {
          resolve([]);
          return;
        }
        try { for (const file of result.tempFiles) validateFile?.(file); } catch (error) { reject(error); return; }
        Promise.all(result.tempFiles.map((file) => saveLocalFile(file.tempFilePath, isValid)))
          .then((savedFiles) => {
            if (!isValid() || savedFiles.some((file) => file.cancelled)) {
              savedFiles.filter((file) => file.persisted).forEach((file) => bestEffortRemoveSavedFile(file.path));
              resolve([]);
              return;
            }
            const failedFiles = savedFiles.filter((file) => !file.persisted);
            if (failedFiles.length > 0) {
              if (!isValid()) {
                resolve([]);
                return;
              }
              savedFiles.filter((file) => file.persisted).forEach((file) => bestEffortRemoveSavedFile(file.path));
              reject(new Error(failedFiles[0]?.reason ?? '本地媒体保存失败'));
              return;
            }
            const paths = savedFiles.map((file) => file.path);
            if (!isValid()) {
              resolve([]);
              return;
            }
            resolve(paths);
          })
          .catch((error) => {
            if (isValid()) reject(error);
            else resolve([]);
          });
      },
      fail: (error) => {
        if (!isValid()) {
          resolve([]);
          return;
        }
        if (error.errMsg.toLowerCase().includes('cancel')) resolve([]);
        else {
          reject(error);
        }
      },
    });
  });
}
