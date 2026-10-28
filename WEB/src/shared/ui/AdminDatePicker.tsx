import { DatePicker } from 'tdesign-react';
import { useId, useLayoutEffect, useRef, useState, type AriaAttributes } from 'react';

interface AdminDatePickerProps extends AriaAttributes {
  type: 'date' | 'month' | 'datetime-local';
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

// Keep the existing local calendar value contract; timezone conversion belongs
// to the feature's API/URL boundary, never to the calendar control.
export function AdminDatePicker({ type, value, onChange, className = '', disabled = false, required, ...aria }: AdminDatePickerProps) {
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();
  const withTime = type === 'datetime-local';
  const format = type === 'month' ? 'YYYY-MM' : withTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  const displayValue = withTime ? value.replace('T', ' ') : value;
  const [editing, setEditing] = useState<{ source: string; draft?: string }>({ source: displayValue });
  if (editing.source !== displayValue) setEditing({ source: displayValue });
  const draft = editing.source === displayValue ? editing.draft : undefined;
  const setDraft = (next?: string) => setEditing(next === undefined ? { source: displayValue } : { source: displayValue, draft: next });
  useLayoutEffect(() => {
      const input = root.current?.querySelector('input');
      if (!input) return;
      input.id ||= id;
      const enclosingLabel = root.current?.closest('label');
      if (enclosingLabel) enclosingLabel.htmlFor = input.id;
      for (const [key, attribute] of Object.entries({ ...aria, 'aria-required': required })) {
        if (attribute === undefined) input.removeAttribute(key);
        else input.setAttribute(key, String(attribute));
      }
  });
  // In 1.18.2 SelectInput otherwise treats DatePicker's typed value as a
  // placeholder while its popup is open. Keep actual input text until commit;
  // calendar/time picks use the same local display format.
  return <span ref={root} className="admin-date-picker" onInputCapture={(event) => {
    if (event.target === root.current?.querySelector('input')) setDraft((event.target as HTMLInputElement).value);
  }}><DatePicker className={className} disabled={disabled} clearable allowInput
    mode={type === 'month' ? 'month' : 'date'} enableTimePicker={withTime}
    format={format} valueType={format} value={displayValue}
    inputProps={{ ...(draft === undefined ? {} : { value: draft }), status: aria['aria-invalid'] ? 'error' : 'default' }}
    popupProps={{ onVisibleChange: (visible) => setDraft(visible ? displayValue : undefined) }}
    onPick={(next) => {
      if (!(next instanceof Date)) return;
      const two = (part: number) => String(part).padStart(2, '0');
      const month = `${next.getFullYear()}-${two(next.getMonth() + 1)}`;
      const date = `${month}-${two(next.getDate())}`;
      setDraft(type === 'month' ? month : withTime ? `${date} ${two(next.getHours())}:${two(next.getMinutes())}` : date);
    }}
    onChange={(next) => { setDraft(undefined); onChange(typeof next === 'string' ? withTime ? next.replace(' ', 'T') : next : ''); }} /></span>;
}
