import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from 'tdesign-react';
import { CameraIcon } from 'tdesign-icons-react';
import { resolveMediaUrl } from '../media/demoMedia';
import { publicMaterialUrl, readyMaterialValue } from '../media/materialUploadIntent';
import { apiIntegrationEnabled, publicEnv } from '../config/env';
import type { ReadyMaterialValue } from '../services/contracts';
import { useAdminServices } from '../services/useAdminServices';
import './MediaThumbnail.css';

export interface MediaThumbnailProps {
  mediaRef: string | null | undefined;
  material?: ReadyMaterialValue | undefined;
  alt: string;
  size?: 'table' | 'detail';
  className?: string;
}
export function MediaThumbnail(props: MediaThumbnailProps) {
  return <MediaThumbnailBody key={props.mediaRef ?? ''} {...props} />;
}
function MediaThumbnailBody({ mediaRef, material, alt, size = 'table', className = '' }: MediaThumbnailProps) {
  const services = useAdminServices();
  const [resolved, setResolved] = useState<{ mediaRef: string; url: string | null; error: boolean } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [readReload, setReadReload] = useState(0);
  const [openSource, setOpenSource] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [previewReload, setPreviewReload] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const closePreview = () => { setOpenSource(null); window.requestAnimationFrame(() => trigger.current?.focus()); };
  let provided: string | null = null;
  let invalid = false;
  if (apiIntegrationEnabled && material && material.material_id === mediaRef) {
    try { provided = publicMaterialUrl(material.public_url, publicEnv.materialPublicOrigin); } catch { invalid = true; }
  }
  const source = apiIntegrationEnabled ? provided ?? (resolved !== null && resolved.mediaRef === mediaRef ? resolved.url : null) : resolveMediaUrl(mediaRef);
  const failed = source !== null && failedSource === source;
  useEffect(() => {
    if (!apiIntegrationEnabled || provided !== null || invalid || !mediaRef) return undefined;
    const controller = new AbortController();
    void services.materials.get(mediaRef, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if (result.material_id !== mediaRef || !result.material_class.endsWith('_IMAGE')) throw new Error('图片原素材不一致');
        const value = readyMaterialValue(result, result.material_class, publicEnv.materialPublicOrigin);
        setResolved({ mediaRef, url: value.public_url, error: false });
      })
      .catch(() => { if (!controller.signal.aborted) setResolved({ mediaRef, url: null, error: true }); });
    return () => controller.abort();
  }, [provided, invalid, mediaRef, services, readReload]);
  const readError = invalid || (resolved !== null && resolved.mediaRef === mediaRef && resolved.error);
  return <><div className={['media-thumbnail', 'media-thumbnail--' + size, className].filter(Boolean).join(' ')}>
    {source !== null && !failed
      ? <Button variant="text" tag="button" ref={trigger} type="button" aria-label={'查看' + alt + '大图'} onClick={(event) => { event.stopPropagation(); setPreviewFailed(false); setPreviewReload(0); setOpenSource(source); }} style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'zoom-in' }}><img key={reload} src={source} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSource(source)} /></Button>
      : <span className="media-thumbnail__fallback" role="img" aria-label={alt + '，暂无图片'}><CameraIcon />{failed || readError ? <Button variant="text" tag="button" type="button" className="media-thumbnail__reload" aria-label={'重新加载' + alt} onClick={() => { setFailedSource(null); if (source !== null) setReload((count) => count + 1); else setReadReload((count) => count + 1); }}>重新加载</Button> : null}</span>}
  </div><Dialog visible={openSource !== null} header={alt + '大图'} width="min(1000px, 92vw)" footer={<Button tag="button" onClick={closePreview}>关闭</Button>} onClose={closePreview} destroyOnClose>
    {openSource === null ? null : <img key={previewReload} src={openSource} alt={alt + '大图'} referrerPolicy="no-referrer" onError={() => setPreviewFailed(true)} style={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', margin: '0 auto', objectFit: 'contain' }} />}
    {previewFailed ? <p role="alert">图片加载失败<Button variant="text" tag="button" type="button" onClick={() => { setPreviewFailed(false); setPreviewReload((count) => count + 1); }}>重新加载原地址</Button></p> : null}
  </Dialog></>;
}
