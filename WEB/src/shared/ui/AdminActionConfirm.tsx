import { Button, Dialog } from 'tdesign-react';
import './AdminActionConfirm.css';

export interface AdminActionConfirmProps {
  visible: boolean;
  title: string;
  objectLabel: string;
  actionLabel: string;
  impact: string;
  recoverable: boolean;
  currentState?: string | undefined;
  targetState?: string | undefined;
  confirmText?: string;
  pending?: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function AdminActionConfirm({
  visible,
  title,
  objectLabel,
  actionLabel,
  impact,
  recoverable,
  currentState,
  targetState,
  confirmText = '确认操作',
  pending = false,
  onCancel,
  onConfirm,
}: AdminActionConfirmProps) {
  return (
    <Dialog
      visible={visible}
      header={title}
      width={520}
      closeOnEscKeydown={!pending}
      closeOnOverlayClick={!pending}
      onClose={onCancel}
      onCancel={onCancel}
      footer={(
        <div className="admin-action-confirm__footer">
          <Button variant="outline" disabled={pending} onClick={onCancel}>取消</Button>
          <Button theme="danger" loading={pending} onClick={onConfirm}>{confirmText}</Button>
        </div>
      )}
    >
      <div className="admin-action-confirm">
        <dl>
          <div><dt>操作对象</dt><dd>{objectLabel}</dd></div>
          <div><dt>执行动作</dt><dd>{actionLabel}</dd></div>
          {currentState === undefined ? null : <div><dt>当前状态</dt><dd>{currentState}</dd></div>}
          {targetState === undefined ? null : <div><dt>目标状态</dt><dd>{targetState}</dd></div>}
          <div><dt>是否可恢复</dt><dd>{recoverable ? '可通过对应恢复操作撤销' : '不可自动恢复'}</dd></div>
        </dl>
        <p className="admin-action-confirm__impact">{impact}</p>
      </div>
    </Dialog>
  );
}
