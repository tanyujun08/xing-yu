import { AdminLink as Link } from '../../shared/ui/AdminLink';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space } from 'tdesign-react';
import { useSession } from '../../shared/access/session';
import { useAdminServices } from '../../shared/services';

export function CabinetMiniProgramCode({ cabinetId }: { cabinetId: string }) {
  const session = useSession();
  return <CabinetCodeBody key={`${session.accountId}:${cabinetId}`} cabinetId={cabinetId} />;
}
function CabinetCodeBody({ cabinetId }: { cabinetId: string }) {
  const session = useSession();
  const gateway = useAdminServices().cabinetManagement;
  const [url, setURL] = useState('');
  const [extension, setExtension] = useState('png');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const active = useRef<AbortController | null>(null);
  const allowed = session.permissions.includes('ops.cabinets.qrcode.read');
  useEffect(() => () => { active.current?.abort(); }, [cabinetId, session.accountId]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!allowed || !gateway?.miniProgramCode) return null;
  const load = async () => {
    if (pending) return;
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError('');
    try { const blob = await gateway.miniProgramCode!(cabinetId, controller.signal); if (!controller.signal.aborted) { setExtension(blob.type === 'image/jpeg' ? 'jpg' : 'png'); setURL(URL.createObjectURL(blob)); } }
    catch { if (!controller.signal.aborted) setError('柜体小程序码暂不可用，请核对封面同步状态后重试。'); }
    finally { if (!controller.signal.aborted) setPending(false); }
  };
  return <section aria-label="柜体小程序码"><Space><Button tag="button" loading={pending} disabled={pending} onClick={() => void load()}>查看柜体小程序码</Button>{url ? <Link href={url} download={`cabinet-${cabinetId}.${extension}`}>下载柜体码</Link> : null}</Space>
    {url ? <div><img src={url} alt="扫码进入本租赁柜详情页面" width={180} height={180} /><p>柜体码用于进入本柜详情页，不含订单或取件码。</p></div> : null}
    {error ? <Alert theme="error" message={error} /> : null}
  </section>;
}
