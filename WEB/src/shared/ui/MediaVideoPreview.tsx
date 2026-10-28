import { useEffect, useState } from 'react';
import { PlayCircleIcon } from 'tdesign-icons-react';
import { Button, Dialog } from 'tdesign-react';
import { apiIntegrationEnabled, publicEnv } from '../config/env';
import { resolveMediaUrl } from '../media/demoMedia';
import { publicMaterialUrl, readyMaterialValue } from '../media/materialUploadIntent';
import type { ReadyMaterialValue } from '../services/contracts';
import { useAdminServices } from '../services/useAdminServices';
import './MediaVideoPreview.css';

export interface MediaVideoPreviewProps {
  mediaRef: string | null | undefined;
  material?: ReadyMaterialValue | undefined;
  label: string;
  className?: string;
}
export function MediaVideoPreview(props: MediaVideoPreviewProps) {
  return <MediaVideoPreviewBody key={props.mediaRef ?? ''} {...props} />;
}
function MediaVideoPreviewBody({ mediaRef, material, label, className = '' }: MediaVideoPreviewProps) {
  const services = useAdminServices();
  const [resolved, setResolved] = useState<ReadyMaterialValue | null>(null);
  const [readError, setReadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterReload, setPosterReload] = useState(0);
  const [readReload, setReadReload] = useState(0);
  const value = material && material.material_id === mediaRef ? material : resolved !== null && resolved.material_id === mediaRef ? resolved : null;
  let playback: string | null = null;
  let poster: string | null = null;
  let invalid = false;
  if (apiIntegrationEnabled && value !== null) {
    try {
      if (!value.material_class.endsWith('_VIDEO')) throw new Error('视频素材类型不一致');
      playback = publicMaterialUrl(value.playback_url, publicEnv.materialPublicOrigin);
      poster = value.poster === null ? null : publicMaterialUrl(value.poster.url, publicEnv.materialPublicOrigin);
      if (playback === null) throw new Error('播放地址尚未就绪');
    } catch { invalid = true; }
  } else if (!apiIntegrationEnabled) playback = resolveMediaUrl(mediaRef);
  useEffect(() => {
    if (!apiIntegrationEnabled || (material && material.material_id === mediaRef) || !mediaRef) return undefined;
    const controller = new AbortController();
    void services.materials.get(mediaRef, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.material_id !== mediaRef || !result.material_class.endsWith('_VIDEO')) throw new Error('视频原素材不一致');
      setResolved(readyMaterialValue(result, result.material_class, publicEnv.materialPublicOrigin));
    }).catch(() => { if (!controller.signal.aborted) setReadError(true); });
    return () => controller.abort();
  }, [mediaRef, material, services, readReload]);
  return <div className={['media-video-preview', className].filter(Boolean).join(' ')}>
    <Button variant="text" tag="button" type="button" className="media-video-preview__open" disabled={playback === null || invalid} onClick={() => { setFailed(false); setOpen(true); }}>
      {poster === null ? <span className="media-video-preview__placeholder"><PlayCircleIcon /></span> : <img key={posterReload} src={poster} alt={label + '自身海报'} referrerPolicy="no-referrer" onError={() => setPosterFailed(true)} onLoad={() => setPosterFailed(false)} />}
      <span>{readError || invalid ? '视频读取失败' : playback === null ? '正在读取视频…' : label}</span>
    </Button>
    {posterFailed ? <p role="alert">视频海报加载失败<Button variant="text" tag="button" type="button" onClick={() => { setPosterFailed(false); setPosterReload((count) => count + 1); }}>重新加载原海报</Button></p> : null}
    {value?.metadata ? <small>{value.metadata.width + ' × ' + value.metadata.height + (value.metadata.duration_ms === null ? '' : ' · ' + (value.metadata.duration_ms / 1000).toFixed(1) + ' 秒')}</small> : null}
    {readError ? <Button variant="text" tag="button" type="button" onClick={() => { setReadError(false); setReadReload((count) => count + 1); }}>重新查询视频</Button> : null}
    <Dialog visible={open} header={label} width="min(900px, 92vw)" footer={false} onClose={() => setOpen(false)} destroyOnClose>
      {playback === null || invalid ? null : <video key={reload} src={playback} poster={poster ?? undefined} controls autoPlay playsInline onError={() => setFailed(true)} style={{ width: '100%', maxHeight: '70vh', background: '#000' }}>当前浏览器不支持视频播放。</video>}
      {failed ? <p role="alert">视频加载失败<Button variant="text" tag="button" type="button" onClick={() => { setFailed(false); setReload((count) => count + 1); }}>重新加载原地址</Button></p> : null}
    </Dialog>
  </div>;
}
