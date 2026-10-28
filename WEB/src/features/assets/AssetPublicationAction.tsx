import { randomId } from '../../shared/randomId';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, MessagePlugin } from 'tdesign-react';
import { useAdminQueryKeys } from '../../shared/query/adminQueryKeys';
import { useAdminServices, type Asset } from '../../shared/services';
import { cabinetManagementFailure } from '../../shared/services/cabinetManagement';
import { publicationBlockerMessages } from './assetPublication';

export function AssetPublicationAction({ asset, variant = 'text', size = 'small' }: {
  asset: Asset; variant?: 'text' | 'outline'; size?: 'small' | 'medium';
}) {
  const services = useAdminServices();
  const queryClient = useQueryClient();
  const keys = useAdminQueryKeys();
  const [uncertain, setUncertain] = useState(false);
  const [lockedTarget, setLockedTarget] = useState<'ONLINE' | 'OFFLINE' | null>(null);
  const original = useRef<Parameters<typeof services.assets.setPublishStatus>[0] | null>(null);
  const target = lockedTarget ?? (asset.publishStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE');
  const label = target === 'ONLINE' ? '上架' : '下架';
  const action = asset.allowedActions?.find((candidate) => candidate.code === (target === 'ONLINE' ? 'PUBLISH' : 'UNPUBLISH'));
  const mutation = useMutation({
    mutationFn: async () => {
      if (original.current === null) {
        if (!asset.version || action?.enabled !== true) throw new Error('当前操作不可用，请刷新资产后核对');
        original.current = { assetId: asset.id, publishStatus: target, expectedVersion: asset.version, command: { intentId: randomId(), idempotencyKey: randomId() } };
        setLockedTarget(target);
      }
      return services.assets.setPublishStatus(original.current);
    },
    onSuccess: async () => {
      original.current = null; setUncertain(false); setLockedTarget(null);
      await queryClient.invalidateQueries({ queryKey: keys.domain('assets') });
      await MessagePlugin.success(target === 'ONLINE' ? '资产已上架，对外开放' : '资产已下架');
    },
    onError: async (error) => {
      const unknown = cabinetManagementFailure(error, true).uncertain;
      setUncertain(unknown && original.current !== null);
      if (!unknown) { original.current = null; setLockedTarget(null); await queryClient.invalidateQueries({ queryKey: keys.domain('assets') }); }
      await MessagePlugin.error(unknown ? `${label}结果尚未确认，请点击“核对${label}”使用原请求核对。` : error.message);
    },
    retry: false,
  });
  if (asset.supplyMode !== 'OFFICIAL') return null;
  return <Button tag="button" size={size} variant={variant} disabled={!uncertain && action?.enabled !== true} loading={mutation.isPending}
    title={uncertain ? '保留原操作、资产版本与幂等键核对结果' : publicationBlockerMessages(action?.blockedReasons ?? asset.publicationBlockers ?? []).join('；')}
    onClick={() => mutation.mutate()}>{uncertain ? `核对${label}` : label}</Button>;
}
