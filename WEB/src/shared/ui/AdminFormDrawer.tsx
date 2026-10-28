import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CloseIcon } from 'tdesign-icons-react';
import {
  Button,
  Dialog,
  Drawer,
  Form,
  type FormInstanceFunctions,
  type FormValidateResult,
} from 'tdesign-react';
import './admin-form-drawer.css';

export type AdminFormDrawerSize = 'compact' | 'complex';
export type AdminFormDrawerTheme = 'default' | 'info' | 'warning' | 'danger' | 'success';

export interface AdminFormDrawerProps {
  visible: boolean;
  title: ReactNode;
  description?: ReactNode | undefined;
  confirmText: string;
  cancelText?: string | undefined;
  form: FormInstanceFunctions;
  values: Record<string, unknown>;
  pending?: boolean | undefined;
  submitBlocked?: boolean | undefined;
  dirty?: boolean | undefined;
  size?: AdminFormDrawerSize | undefined;
  theme?: AdminFormDrawerTheme | undefined;
  errorSummary?: ReactNode | undefined;
  children: ReactNode;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}

interface ValidationIssue {
  field?: string;
  message: string;
}

const AUTO_FOCUS_ATTEMPTS = 6;
const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly])',
  'textarea:not([disabled]):not([readonly])',
  'select:not([disabled])',
  '[role="combobox"]:not([aria-disabled="true"])',
  '[contenteditable="true"]',
].join(', ');
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFormElement(form: FormInstanceFunctions) {
  return form.getCurrentElement?.() ?? form.currentElement ?? null;
}

function getDrawerPanel(bodyElement: HTMLElement | null) {
  return bodyElement?.closest<HTMLElement>('.t-drawer__content-wrapper') ?? null;
}

function canReceiveFocus(element: HTMLElement) {
  return !element.hidden && element.getAttribute('aria-hidden') !== 'true' && element.tabIndex >= 0;
}

function focusElement(element: HTMLElement | null, scrollIntoView = true) {
  if (!element) return false;
  if (scrollIntoView && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  element.focus({ preventScroll: true });
  return document.activeElement === element;
}

function findNamedControl(formElement: HTMLElement, field: string) {
  return Array.from(formElement.querySelectorAll<HTMLElement>('[name]')).find(
    (element) => element.getAttribute('name') === field,
  ) ?? null;
}

function findInvalidControl(formElement: HTMLElement, field?: string) {
  const namedControl = field ? findNamedControl(formElement, field) : null;
  if (namedControl) return namedControl;

  return formElement.querySelector<HTMLElement>(
    '.t-form__controls.t-is-error input, '
      + '.t-form__controls.t-is-error textarea, '
      + '.t-form__controls.t-is-error select, '
      + '.t-form__controls.t-is-error [role="combobox"]',
  );
}

function focusFirstInvalidField(form: FormInstanceFunctions, field?: string) {
  let attempt = 0;
  const focusWhenRendered = () => {
    requestAnimationFrame(() => {
      const formElement = getFormElement(form);
      const invalidField = formElement ? findInvalidControl(formElement, field) : null;
      const focused = focusElement(invalidField);

      attempt += 1;
      if (!focused && attempt < AUTO_FOCUS_ATTEMPTS) focusWhenRendered();
    });
  };

  focusWhenRendered();
}

function collectValidationIssues(
  validateResult: FormValidateResult<Record<string, unknown>>,
  firstError?: string,
) {
  if (validateResult === true) return [];

  const issues: ValidationIssue[] = [];
  if (validateResult && typeof validateResult === 'object') {
    Object.entries(validateResult).forEach(([field, result]) => {
      if (!Array.isArray(result)) return;

      result.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        if ('result' in item && item.result === true) return;
        const message = 'message' in item && typeof item.message === 'string'
          ? item.message
          : '请检查此字段。';
        issues.push({ field, message });
      });
    });
  }

  if (issues.length === 0) {
    issues.push({ message: firstError || '请检查标记为错误的字段。' });
  }

  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.field ?? ''}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function restoreFocus(element: HTMLElement | null) {
  if (!element || !element.isConnected) return;
  requestAnimationFrame(() => {
    if (element.isConnected) element.focus({ preventScroll: true });
  });
}

function resolveConfirmTheme(theme: AdminFormDrawerTheme) {
  if (theme === 'warning' || theme === 'danger' || theme === 'success') return theme;
  return 'primary';
}

export function AdminFormDrawer({
  visible,
  title,
  description,
  confirmText,
  cancelText = '取消',
  form,
  values,
  pending = false,
  submitBlocked = false,
  dirty = false,
  size = 'compact',
  theme = 'default',
  errorSummary,
  children,
  onSubmit,
  onCancel,
}: AdminFormDrawerProps) {
  const formId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const errorSummaryId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastDrawerFocusRef = useRef<HTMLElement | null>(null);
  const wasVisibleRef = useRef(false);
  const mountedRef = useRef(true);
  const submitLockRef = useRef(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busy = pending || submitting;
  const hasExternalError = errorSummary !== undefined && errorSummary !== null && errorSummary !== false;
  const hasErrorSummary = hasExternalError || submitError !== null || validationIssues.length > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (wasVisibleRef.current) restoreFocus(previousFocusRef.current);
    };
  }, []);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    if (visible && !wasVisible) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    } else if (!visible && wasVisible) {
      restoreFocus(previousFocusRef.current);
    }
    wasVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (visible) form.setFieldsValue(values);
  }, [form, values, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    let attempt = 0;
    let frame = 0;
    let cancelled = false;
    const focusFirstEditableControl = () => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const formElement = getFormElement(form);
        const editableControl = formElement?.querySelector<HTMLElement>(EDITABLE_SELECTOR) ?? null;
        const focused = focusElement(editableControl, false);

        attempt += 1;
        if (!focused && attempt < AUTO_FOCUS_ATTEMPTS) focusFirstEditableControl();
      });
    };

    focusFirstEditableControl();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [form, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    let attempt = 0;
    let frame = 0;
    let cancelled = false;
    const applyAccessibilityAttributes = () => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const panel = getDrawerPanel(bodyRef.current);
        if (!panel) {
          attempt += 1;
          if (attempt < AUTO_FOCUS_ATTEMPTS) applyAccessibilityAttributes();
          return;
        }

        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', titleId);
        panel.setAttribute('aria-busy', String(busy));
        const describedBy = [
          description === undefined ? null : descriptionId,
          hasErrorSummary ? errorSummaryId : null,
        ].filter(Boolean).join(' ');
        if (describedBy) panel.setAttribute('aria-describedby', describedBy);
        else panel.removeAttribute('aria-describedby');
      });
    };

    applyAccessibilityAttributes();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [busy, description, descriptionId, errorSummaryId, hasErrorSummary, titleId, visible]);

  useEffect(() => {
    if (!visible || discardConfirmOpen) return undefined;

    const containKeyboardFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const panel = getDrawerPanel(bodyRef.current);
      if (!panel) return;
      const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(canReceiveFocus);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0]!;
      const last = focusableElements[focusableElements.length - 1]!;
      const activeElement = document.activeElement;
      if (!panel.contains(activeElement)) {
        event.preventDefault();
        focusElement(event.shiftKey ? last : first);
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        focusElement(first);
      }
    };

    document.addEventListener('keydown', containKeyboardFocus, true);
    return () => document.removeEventListener('keydown', containKeyboardFocus, true);
  }, [discardConfirmOpen, visible]);

  const clearErrors = useCallback(() => {
    setValidationIssues([]);
    setSubmitError(null);
    form.clearValidate();
  }, [form]);

  const rememberDrawerFocus = useCallback(() => {
    const panel = getDrawerPanel(bodyRef.current);
    const activeElement = document.activeElement;
    if (panel && activeElement instanceof HTMLElement && panel.contains(activeElement)) {
      lastDrawerFocusRef.current = activeElement;
    }
  }, []);

  const continueEditing = useCallback(() => {
    setDiscardConfirmOpen(false);
    restoreFocus(lastDrawerFocusRef.current);
  }, []);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) {
      rememberDrawerFocus();
      setDiscardConfirmOpen(true);
      return;
    }
    clearErrors();
    onCancel();
  }, [busy, clearErrors, dirty, onCancel, rememberDrawerFocus]);

  const discardChanges = useCallback(() => {
    setDiscardConfirmOpen(false);
    clearErrors();
    onCancel();
  }, [clearErrors, onCancel]);

  const finishSubmit = (
    validateResult: FormValidateResult<Record<string, unknown>>,
    firstError?: string,
  ) => {
    if (validateResult !== true) {
      const issues = collectValidationIssues(validateResult, firstError);
      setValidationIssues(issues);
      setSubmitError(null);
      focusFirstInvalidField(form, issues.find((issue) => issue.field)?.field);
      return;
    }
    if (pending || submitBlocked || submitLockRef.current) return;

    submitLockRef.current = true;
    setSubmitting(true);
    setValidationIssues([]);
    setSubmitError(null);

    void (async () => {
      try {
        await onSubmit();
      } catch (error: unknown) {
        if (!mountedRef.current) return;
        setSubmitError(
          error instanceof Error && error.message
            ? error.message
            : '提交失败，请稍后重试。',
        );
      } finally {
        submitLockRef.current = false;
        if (mountedRef.current) setSubmitting(false);
      }
    })();
  };

  const drawerSize = size === 'complex'
    ? 'var(--xy-admin-form-drawer-width-complex)'
    : 'var(--xy-admin-form-drawer-width-compact)';

  return (
    <>
      <Drawer
        visible={visible}
        placement="right"
        size={drawerSize}
        className={`admin-form-drawer admin-form-drawer--${size}`}
        header={(
          <div className="admin-form-drawer__header-content">
            <div className="admin-form-drawer__heading">
              <h2 id={titleId}>{title}</h2>
              {description === undefined ? null : <p id={descriptionId}>{description}</p>}
            </div>
            <Button
              aria-label="关闭"
              title="关闭"
              tag="button"
              type="button"
              variant="text"
              shape="square"
              icon={<CloseIcon />}
              disabled={busy}
              className="admin-form-drawer__close"
              onClick={requestClose}
            />
          </div>
        )}
        footer={(
          <div className="admin-form-drawer__footer-actions" aria-label="表单操作">
            <Button tag="button" type="button" variant="outline" disabled={busy} onClick={requestClose}>
              {cancelText}
            </Button>
            <Button
              tag="button"
              type="submit"
              form={formId}
              theme={resolveConfirmTheme(theme)}
              loading={busy}
              disabled={busy || submitBlocked}
            >
              {confirmText}
            </Button>
          </div>
        )}
        closeBtn={false}
        closeOnEscKeydown={!busy}
        closeOnOverlayClick={!busy}
        destroyOnClose
        preventScrollThrough
        onBeforeOpen={() => {
          setValidationIssues([]);
          setSubmitError(null);
          setDiscardConfirmOpen(false);
          form.clearValidate();
        }}
        onBeforeClose={() => form.clearValidate()}
        onClose={requestClose}
      >
        <div ref={bodyRef} className="admin-form-drawer__body">
          {hasErrorSummary ? (
            <div
              id={errorSummaryId}
              className="admin-form-drawer__error-summary"
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
            >
              <strong>{validationIssues.length > 0 ? '请检查以下内容' : '暂时无法保存'}</strong>
              {hasExternalError ? <div className="admin-form-drawer__error-detail">{errorSummary}</div> : null}
              {submitError ? <div className="admin-form-drawer__error-detail">{submitError}</div> : null}
              {validationIssues.length > 0 ? (
                <ul>
                  {validationIssues.map((issue, index) => (
                    <li key={`${issue.field ?? 'form'}-${issue.message}-${index}`}>
                      {issue.field ? (
                        <Button variant="text" tag="button"
                          type="button"
                          className="admin-form-drawer__error-link"
                          onClick={() => focusFirstInvalidField(form, issue.field)}
                        >
                          {issue.message}
                        </Button>
                      ) : issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Form
            id={formId}
            form={form}
            initialData={values}
            labelAlign="top"
            requiredMarkPosition="left"
            scrollToFirstError="smooth"
            className="admin-form"
            onSubmit={({ validateResult, firstError }) => finishSubmit(
              validateResult as FormValidateResult<Record<string, unknown>>,
              firstError,
            )}
          >
            {children}
          </Form>
        </div>
      </Drawer>

      <Dialog
        visible={visible && discardConfirmOpen}
        header="放弃未保存的修改？"
        width={440}
        theme="warning"
        dialogClassName="admin-form-discard-dialog"
        confirmBtn={{ content: '放弃修改', theme: 'danger' }}
        cancelBtn="继续编辑"
        closeOnOverlayClick={false}
        onClose={continueEditing}
        onConfirm={discardChanges}
      >
        当前录入内容尚未保存，关闭后本次草稿将被清空。
      </Dialog>
    </>
  );
}
