import { Button, Progress, Upload } from 'tdesign-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AddIcon, DeleteIcon, UploadIcon, VideoIcon } from 'tdesign-icons-react';
import { ApiProblem } from '../api/problem';
import { apiIntegrationEnabled, publicEnv } from '../config/env';
import { readMediaFile, type StagedMediaFile } from '../media/demoMedia';
import { createMaterialUploadIntent, readyMaterialValue, restoreMaterialUploadIntent, type MaterialUploadIntent } from '../media/materialUploadIntent';
import type { MaterialClass } from '../services/contracts';
import { useAdminServices } from '../services/useAdminServices';
import { MediaThumbnail } from './MediaThumbnail';
import { MediaVideoPreview } from './MediaVideoPreview';
import './MediaUploadField.css';

export interface MediaUploadState { pending: boolean; failed: boolean; unknown: boolean; blocked: boolean }
export interface MediaUploadFieldProps {
  kind: 'image' | 'video';
  value: readonly StagedMediaFile[];
  onChange: (value: StagedMediaFile[]) => void;
  onStateChange?: (state: MediaUploadState) => void;
  max?: number;
  allowReorder?: boolean;
  label: string;
  materialClass?: MaterialClass;
  ownerId?: string | null | undefined;
  active?: boolean;
}
interface PendingUpload {
  intent: MaterialUploadIntent;
  state: 'uploading' | 'processing' | 'unknown' | 'failed' | 'expired';
  materialId?: string;
  loaded: number;
  total: number | null;
  message: string;
}
const limits = {
  image: { accept: 'image/png,image/jpeg,image/webp', bytes: 10 * 1024 * 1024, text: 'PNG / JPG / WebP，单张不超过 10 MiB（以服务端策略为准）' },
  video: { accept: 'video/mp4', bytes: 104_857_600, text: 'MP4，单个不超过 100 MiB（104,857,600 字节）' },
} as const;
const idleState: MediaUploadState = { pending: false, failed: false, unknown: false, blocked: false };
function isDefinitiveUploadFailure(error: unknown): boolean {
  return error instanceof ApiProblem && ['VALIDATION_FAILED', 'UNSUPPORTED_MEDIA_TYPE', 'PAYLOAD_TOO_LARGE', 'IDEMPOTENCY_CONFLICT', 'RESOURCE_CONFLICT', 'MATERIAL_REJECTED'].includes(error.code);
}
function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2000);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
export function MediaUploadField(props: MediaUploadFieldProps) {
  return <MediaUploadFieldBody key={[props.ownerId ?? '', props.active ?? true, props.kind, props.materialClass ?? ''].join(':')} {...props} />;
}
function MediaUploadFieldBody({ kind, value, onChange, onStateChange, max = kind === 'image' ? 6 : 2, allowReorder = false, label, materialClass, ownerId, active = true }: MediaUploadFieldProps) {
  const services = useAdminServices();
  const upload = useRef<{ triggerUpload: () => void } | null>(null);
  const [entries, setEntries] = useState<PendingUpload[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const scope = useRef({ generation: 0, owner: ownerId, active });
  const controllers = useRef(new Map<string, AbortController>());
  const inFlight = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const stateCallback = useRef(onStateChange);
  const remote = apiIntegrationEnabled;
  const config = limits[kind];
  useLayoutEffect(() => { valueRef.current = value; onChangeRef.current = onChange; stateCallback.current = onStateChange; }, [value, onChange, onStateChange]);
  useLayoutEffect(() => {
    scope.current = { generation: scope.current.generation + 1, owner: ownerId, active };
    const requests = controllers.current;
    return () => {
      scope.current.generation += 1;
      scope.current.active = false;
      requests.forEach((controller) => controller.abort());
      requests.clear();
      inFlight.current = false;
      stateCallback.current?.(idleState);
    };
  }, [ownerId, active, materialClass, kind]);
  const pending = entries.some((entry) => entry.state === 'uploading' || entry.state === 'processing');
  const failed = entries.some((entry) => entry.state === 'failed' || entry.state === 'expired');
  const unknown = entries.some((entry) => entry.state === 'unknown');
  useEffect(() => { onStateChange?.({ pending, failed, unknown, blocked: pending || failed || unknown }); }, [pending, failed, unknown, onStateChange]);
  const remember = (entry: PendingUpload) => setEntries((items) => {
    const index = items.findIndex((item) => item.intent.key === entry.intent.key);
    return index < 0 ? [...items, entry] : items.map((item, i) => i === index ? entry : item);
  });
  const execute = async (entry: PendingUpload, recover = false, queryOnly = false) => {
    const generation = scope.current.generation;
    if (!scope.current.active || !ownerId || !materialClass || entry.intent.owner !== ownerId) return;
    if (recover) restoreMaterialUploadIntent(entry.intent, ownerId, entry.intent.file, materialClass);
    const controller = new AbortController();
    controllers.current.set(entry.intent.key, controller);
    setActiveKey(entry.intent.key);
    stateCallback.current?.({ pending: true, failed: false, unknown: false, blocked: true });
    const current = () => scope.current.generation === generation && scope.current.active && scope.current.owner === entry.intent.owner && controllers.current.get(entry.intent.key) === controller && !controller.signal.aborted;
    let next: PendingUpload = { ...entry, state: queryOnly ? 'processing' : 'uploading', message: '' };
    remember(next);
    try {
      let result = queryOnly && next.materialId
        ? await services.materials.get(next.materialId, { signal: controller.signal })
        : await services.materials.uploadFile(entry.intent.file, entry.intent.materialClass, entry.intent.key, { signal: controller.signal, onUploadProgress: (progress) => {
          if (current()) { next = { ...next, loaded: progress.loaded, total: progress.total }; remember(next); }
        } });
      if (!current()) return;
      if (!result.material_id || result.material_id.length > 64 || (next.materialId && result.material_id !== next.materialId)) throw new Error('素材查询返回了不同的原素材 ID');
      next = { ...next, materialId: result.material_id, state: 'processing' };
      remember(next);
      for (let poll = 0; ; poll += 1) {
        if (!current()) return;
        if (result.material_id !== next.materialId || ('material_class' in result && result.material_class !== entry.intent.materialClass) || ('owner_account_id' in result && result.owner_account_id !== undefined && result.owner_account_id !== entry.intent.owner)) throw new Error('素材回读与原上传账户、类型或 ID 不一致');
        if (result.status === 'READY') {
          const material = readyMaterialValue(result, entry.intent.materialClass, publicEnv.materialPublicOrigin);
          const file: StagedMediaFile = { id: material.material_id, materialId: material.material_id, name: entry.intent.file.name, mimeType: material.mime_type, size: material.size_bytes, dataUrl: material.public_url!, material };
          const updated = [...valueRef.current, file];
          valueRef.current = updated;
          onChangeRef.current(updated);
          setEntries((items) => items.filter((item) => item.intent.key !== entry.intent.key));
          return;
        }
        if (!['UPLOADED', 'SCANNING', 'PROCESSING'].includes(result.status)) {
          next = { ...next, state: 'failed', message: 'rejection_reason' in result && result.rejection_reason ? result.rejection_reason : '服务端拒绝了该素材，请移除后重新选择' };
          remember(next); return;
        }
        if (poll >= 60) { remember({ ...next, message: '仍在处理中，可继续查询原素材状态' }); return; }
        await waitForPoll(controller.signal);
        if (!current()) return;
        result = await services.materials.get(next.materialId!, { signal: controller.signal });
      }
    } catch (caught) {
      if (!current()) return;
      const message = caught instanceof Error ? caught.message : '上传结果未知';
      const expired = entry.state === 'expired' || (caught instanceof ApiProblem && caught.code === 'MATERIAL_UPLOAD_EXPIRED');
      remember({ ...next, state: expired ? 'expired' : next.materialId ? 'processing' : isDefinitiveUploadFailure(caught) ? 'failed' : 'unknown', message });
    } finally {
      if (controllers.current.get(entry.intent.key) === controller) controllers.current.delete(entry.intent.key);
      if (scope.current.generation === generation) setActiveKey((key) => key === entry.intent.key ? null : key);
    }
  };
  const stageFiles = async (selected: readonly File[]) => {
    if (inFlight.current || !active) return;
    if (remote && (!materialClass || !ownerId)) { setError('上传账户或素材类型不可用，请恢复登录状态'); return; }
    const remaining = max - valueRef.current.length - entries.length;
    if (remaining <= 0) { setError('最多可上传 ' + max + ' 个文件'); return; }
    if (selected.length > remaining) { setError('还可上传 ' + remaining + ' 个文件，本次选择超额，整批未上传'); return; }
    const invalid = selected.find((file) => file.size <= 0 || !config.accept.split(',').includes(file.type) || file.size > config.bytes);
    if (invalid) { setError(invalid.name + ' 格式或大小不符合要求。' + config.text); return; }
    const generation = scope.current.generation;
    inFlight.current = true; setRunning(true); setError('');
    try {
      for (const file of selected) {
        if (scope.current.generation !== generation || !scope.current.active) break;
        if (!remote) {
          const staged = await readMediaFile(file);
          if (scope.current.generation !== generation || !scope.current.active) break;
          const next = [...valueRef.current, staged]; valueRef.current = next; onChangeRef.current(next);
        } else {
          await execute({ intent: createMaterialUploadIntent(ownerId!, file, materialClass!), state: 'uploading', loaded: 0, total: null, message: '' });
        }
      }
    } catch (caught) {
      if (scope.current.generation === generation) setError(caught instanceof Error ? caught.message : '无法读取文件');
    } finally {
      if (scope.current.generation === generation) { inFlight.current = false; setRunning(false); }
    }
  };
  const resume = async (entry: PendingUpload, queryOnly: boolean) => {
    if (inFlight.current) return;
    const generation = scope.current.generation;
    inFlight.current = true; setRunning(true);
    try { await execute(entry, !queryOnly, queryOnly); }
    finally { if (scope.current.generation === generation) { inFlight.current = false; setRunning(false); } }
  };
  const cancelEntry = (entry: PendingUpload) => {
    controllers.current.get(entry.intent.key)?.abort();
    controllers.current.delete(entry.intent.key);
    setActiveKey((key) => key === entry.intent.key ? null : key);
    remember({ ...entry, state: entry.materialId ? 'processing' : 'unknown', message: entry.materialId ? '已停止查询；可继续查询原素材 ID' : '已取消本次等待，结果未知；恢复会复用原文件和原请求' });
  };
  return <div className="media-upload-field">
    <Upload ref={(control) => { upload.current = control; control?.upload?.setAttribute('aria-label', label + '文件选择'); }}
      theme="custom" draggable accept={config.accept} multiple={max > 1} disabled={running || !active}
      autoUpload={false} files={[]} uploadPastedFiles={false} fileListDisplay={() => null}
      beforeAllFilesUpload={() => false} onSelectChange={(files) => { void stageFiles(files); }}
      trigger={<Button tag="button" type="button" variant="text" className="media-upload-field__dropzone" disabled={running || !active}>
      <span className="media-upload-field__icon">{kind === 'image' ? <UploadIcon /> : <VideoIcon />}</span>
      <strong>{label}</strong><span>{running ? '正在上传或处理素材' : '点击选择或将文件拖到这里'}</span><small>{config.text + ' · 最多 ' + max + ' 个'}</small>
    </Button>} />
    {entries.map((entry) => <div key={entry.intent.key} className="media-upload-field__pending" role="status">
      <span>{entry.intent.file.name + ' · ' + (entry.state === 'uploading' ? '上传中' : entry.state === 'processing' ? '处理中' : entry.state === 'unknown' ? '结果未知' : entry.state === 'expired' ? '上传已过期' : '上传失败') + (entry.materialId ? ' · ' + entry.materialId : '')}</span>
      {entry.state === 'uploading' ? <><div className="media-upload-field__progress" role="progressbar" aria-label={entry.intent.file.name + '上传进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={entry.total ? Math.min(100, Math.floor(entry.loaded / entry.total * 100)) : undefined}><Progress percentage={entry.total ? Math.min(100, Math.floor(entry.loaded / entry.total * 100)) : 0} label={false} status="active" /></div><small>{entry.total === null ? entry.loaded + ' 字节已发送' : Math.min(100, Math.floor(entry.loaded / entry.total * 100)) + '% 已发送，等待服务端处理'}</small></> : null}
      {entry.message ? <p>{entry.message}</p> : null}
      {activeKey === entry.intent.key ? <Button variant="text" tag="button" type="button" onClick={() => cancelEntry(entry)}>取消上传或查询</Button> : null}
      {entry.materialId && !running ? <Button variant="text" tag="button" type="button" disabled={running} onClick={() => void resume(entry, true)}>查询状态</Button> : !entry.materialId && entry.state === 'unknown' ? <Button variant="text" tag="button" type="button" disabled={running} onClick={() => void resume(entry, false)}>恢复原上传</Button> : null}
      <Button variant="text" tag="button" type="button" onClick={() => { controllers.current.get(entry.intent.key)?.abort(); controllers.current.delete(entry.intent.key); setEntries((items) => items.filter((item) => item.intent.key !== entry.intent.key)); }}>{entry.state === 'expired' ? '结束已过期上传' : '移除待办'}</Button>
    </div>)}
    {value.length === 0 ? null : <div className="media-upload-field__files">
      {value.map((file, index) => <article key={file.id} className="media-upload-field__file">
        {kind === 'image' ? <MediaThumbnail mediaRef={remote ? file.materialId : file.dataUrl} material={file.material} alt={label + ' ' + (index + 1)} /> : <div className="media-upload-field__video"><VideoIcon /><span>{file.name}</span><MediaVideoPreview mediaRef={remote ? file.materialId : file.dataUrl} material={file.material} label="播放视频" /></div>}
        {kind === 'image' && index === 0 ? <span className="media-upload-field__cover">封面</span> : null}
        {allowReorder && kind === 'image' ? <div className="media-upload-field__order"><Button variant="text" tag="button" type="button" disabled={running || index === 0} aria-label={'第 ' + (index + 1) + ' 张图片上移'} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; onChange(next); }}>上移</Button><Button variant="text" tag="button" type="button" disabled={running || index === value.length - 1} aria-label={'第 ' + (index + 1) + ' 张图片下移'} onClick={() => { const next = [...value]; [next[index], next[index + 1]] = [next[index + 1]!, next[index]!]; onChange(next); }}>下移</Button></div> : null}
        <Button variant="text" tag="button" type="button" className="media-upload-field__remove" disabled={running} aria-label={'删除 ' + file.name} onClick={() => onChange(value.filter((candidate) => candidate.id !== file.id))}><DeleteIcon /></Button>
      </article>)}
      {value.length + entries.length < max ? <Button tag="button" type="button" variant="outline" className="media-upload-field__append" disabled={running || !active} onClick={() => upload.current?.triggerUpload()}><AddIcon /><span>继续上传</span></Button> : null}
    </div>}
    {error === '' ? null : <p className="media-upload-field__error" role="alert">{error}</p>}
    <p className="media-upload-field__note">{remote ? '素材就绪后自动回填；业务只保存原素材 ID 和顺序。' : '当前入口仅生成本地演示预览，不上传云端。'}</p>
  </div>;
}
