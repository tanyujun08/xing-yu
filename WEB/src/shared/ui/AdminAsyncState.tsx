import { Button, Loading } from 'tdesign-react';
import './AdminAsyncState.css';

export type AdminAsyncStateKind = 'loading' | 'empty' | 'filtered-empty' | 'forbidden' | 'error' | 'timeout' | 'conflict' | 'unknown' | 'offline';

export interface AdminAsyncStateProps {
  kind: AdminAsyncStateKind;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

const defaultCopy: Record<AdminAsyncStateKind, { title: string; description: string }> = {
  loading: { title: '正在加载', description: '正在获取最新数据，请稍候。' },
  empty: { title: '暂无数据', description: '当前场景还没有可展示的记录。' },
  'filtered-empty': { title: '没有符合条件的结果', description: '请调整筛选条件后再试。' },
  forbidden: { title: '当前角色无权访问', description: '请切换到具备该能力的管理员身份。' },
  error: { title: '数据加载失败', description: '服务未能返回数据，请重新加载。' },
  timeout: { title: '请求处理超时', description: '网络或服务响应较慢，可以稍后重试。' },
  conflict: { title: '数据已经发生变化', description: '请刷新页面，确认最新状态后重新操作。' },
  unknown: { title: '操作结果未知', description: '请先查询最新状态，不要重复提交。' },
  offline: { title: '当前处于离线状态', description: '恢复网络连接后再重新加载。' },
};

export function AdminAsyncState({ kind, title, description, actionLabel, onAction, compact = false }: AdminAsyncStateProps) {
  const copy = defaultCopy[kind];
  return (
    <div
      className={`admin-async-state admin-async-state--${kind}${compact ? ' admin-async-state--compact' : ''}`}
      role={kind === 'error' || kind === 'forbidden' || kind === 'timeout' || kind === 'conflict' || kind === 'unknown' ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
    >
      {kind === 'loading' ? <Loading size="small" /> : <span className="admin-async-state__indicator" aria-hidden="true" />}
      <div className="admin-async-state__copy">
        <strong>{title ?? copy.title}</strong>
        <p>{description ?? copy.description}</p>
      </div>
      {actionLabel === undefined || onAction === undefined ? null : (
        <Button variant="outline" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
