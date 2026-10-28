import { isPublicMaterialURL, publicMedia } from './material-media';
import type { PublicMaterialMedia } from '../model/material-media';

type Slot = { slot_key: string; title: string; kind: string; stage: string; instruction: string; min_count: number; max_count: number; sort_order: number; example: { url: string; poster_url: string | null } | null };
type Item = { evidence_id: string; material_id: string; item_no: number; kind: string; availability: string; media: PublicMaterialMedia | null };
type Draft = { slotKey: string; itemNo: number; intent: { phase: string; progress: number; error: string; file: string } };
export type ReturnEvidenceTile = { key: string; slotKey: string; itemNo: number; title: string; kind: string; instruction: string; url: string; poster: string; example: string; examplePoster: string; editable: boolean; ready: boolean; pending: boolean; failed: boolean; state: string; error: string; draftPreview: string };
export function returnEvidenceTiles(slots: { slot: Slot; items: Item[]; editable: boolean; complete: boolean }[], drafts: Draft[], stage: string): ReturnEvidenceTile[] {
  const phases: Record<string, string> = { SELECTED: '待上传', UPLOADING: '上传中', PROCESSING: '处理中', UNKNOWN: '结果待核实', FAILED: '上传失败', READY: '正在保存', CANCELLED: '已取消' };
  return [...slots].filter(v => v.slot.stage === stage).sort((a, b) => a.slot.sort_order - b.slot.sort_order).flatMap(({ slot, items, editable }) => Array.from({ length: slot.max_count }, (_, index) => {
    const itemNo = index + 1, item = items.find(v => v.item_no === itemNo), draft = drafts.find(v => v.slotKey === slot.slot_key && v.itemNo === itemNo);
    const media = item?.availability === 'READY' && item.media?.material_id === item.material_id ? publicMedia(item.media) : null;
    const example = slot.example && isPublicMaterialURL(slot.example.url) ? slot.example : null;
    return { key: slot.slot_key + ':' + itemNo, slotKey: slot.slot_key, itemNo, title: slot.title + (slot.max_count > 1 ? ' ' + itemNo : ''), kind: slot.kind, instruction: slot.instruction, url: media?.url ?? '', poster: media?.poster ?? '', example: example?.url ?? '', examplePoster: example?.poster_url && isPublicMaterialURL(example.poster_url) ? example.poster_url : '', editable, draftPreview: draft && slot.kind === 'PHOTO' ? draft.intent.file : '', ready: !!media, pending: !!draft, failed: draft?.intent.phase === 'FAILED', state: draft ? (phases[draft.intent.phase] ?? '结果待核实') + (draft.intent.phase === 'UPLOADING' ? ' ' + draft.intent.progress + '%' : '') : media ? '已保存' : item ? '凭证暂不可用' : itemNo <= slot.min_count ? '待上传' : '选填', error: draft?.intent.error ?? '' };
  }));
}
