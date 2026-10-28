import { demoStorage } from '../../preview/storage';
import { demoWx } from '../../preview/platform';
import { accountApi } from './account-api';
import { newIdempotencyKey } from './idempotency';
import { createMaterialUploadIntent, type MaterialUploadIntent } from '../model/material-media';
import { runMaterialUpload } from './material-upload';
import type { OperationScope } from '../interaction/operation-scope';

export type ChatImageDraft = { owner: string; conversationId: string; upload: MaterialUploadIntent; url: string };
const key = (owner: string, conversation: string) => 'xingyu.order-chat-image.v1:' + encodeURIComponent(owner) + ':' + encodeURIComponent(conversation);
function persist(value: ChatImageDraft) { demoStorage.setStorageSync(key(value.owner, value.conversationId), value); }
function removeFile(file: string) { wx.getFileSystemManager().removeSavedFile({ filePath: file, fail: () => undefined }); }
export const chatImageDrafts = {
  load(conversationId: string): ChatImageDraft | null {
    const owner = accountApi.sessionIdentity(); if (!owner) return null;
    const value = demoStorage.getStorageSync(key(owner, conversationId)) as ChatImageDraft | undefined;
    if (!value) return null;
    if (value.owner !== owner || value.conversationId !== conversationId || value.upload?.owner !== owner || value.upload.materialClass !== 'CHAT_IMAGE' || value.upload.item !== conversationId || !value.upload.file) throw new Error('图片原意图无法核实');
    return value;
  },
  async create(conversationId: string, active: () => boolean, resume: () => Promise<boolean> = async () => active()): Promise<ChatImageDraft | null> {
    const owner = accountApi.sessionIdentity(); if (!owner || !active()) return null;
    if (this.load(conversationId)) throw new Error('请先处理当前图片');
    const choice = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => demoWx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['original'], success: resolve, fail: reject }));
    if (!await resume()) return null;
    if (!active() || accountApi.sessionIdentity() !== owner) return null;
    const file = choice.tempFiles[0]; if (!file || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error('请选择不超过 10 MB 的图片');
    const image = await new Promise<WechatMiniprogram.GetImageInfoSuccessCallbackResult>((resolve, reject) => wx.getImageInfo({ src: file.tempFilePath, success: resolve, fail: reject }));
    if (!['png', 'jpeg', 'jpg', 'webp'].includes(image.type.toLowerCase())) throw new Error('仅支持 JPEG、PNG 或 WebP 图片');
    if (!active() || accountApi.sessionIdentity() !== owner) return null;
    const saved = await new Promise<string>((resolve, reject) => wx.getFileSystemManager().saveFile({ tempFilePath: file.tempFilePath, success: value => resolve(value.savedFilePath), fail: reject }));
    if (!active() || accountApi.sessionIdentity() !== owner) { removeFile(saved); return null; }
    const draft: ChatImageDraft = { owner, conversationId, url: '', upload: createMaterialUploadIntent({ owner, field: 'order-message-image', item: conversationId, generation: Date.now(), file: saved, key: newIdempotencyKey('chat-image'), materialClass: 'CHAT_IMAGE' }) };
    try { persist(draft); if (this.load(conversationId)?.upload.key !== draft.upload.key) throw new Error('图片原意图未能保存'); }
    catch (error) { removeFile(saved); throw error; }
    return draft;
  },
  async upload(draft: ChatImageDraft, scope: OperationScope, active: () => boolean, changed: () => void, recovery = false) {
    if (draft.upload.phase === 'READY') return;
    try {
      const media = await runMaterialUpload(draft.upload, { scope, isCurrent: () => active() && accountApi.sessionIdentity() === draft.owner,
        explicitRecovery: recovery, onState: () => { persist(draft); changed(); },
      }).promise;
      draft.url = media.src;
    } finally { persist(draft); if (active()) changed(); }
  },
  clear(draft: ChatImageDraft) {
    if (accountApi.sessionIdentity() !== draft.owner) return;
    if (this.load(draft.conversationId)?.upload.key !== draft.upload.key) return;
    demoStorage.removeStorageSync(key(draft.owner, draft.conversationId)); removeFile(draft.upload.file);
  },
};
