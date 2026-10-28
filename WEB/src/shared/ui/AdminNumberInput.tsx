import { InputNumber, type InputNumberProps } from 'tdesign-react';
import { useId, useLayoutEffect, useRef, type AriaAttributes } from 'react';

type Props = InputNumberProps & AriaAttributes & { required?: boolean };

export function AdminNumberInput({ required, 'aria-label': label, 'aria-invalid': invalid, 'aria-describedby': describedBy, ...props }: Props) {
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();
  useLayoutEffect(() => {
      const input = root.current?.querySelector('input');
      if (!input) return;
      input.id ||= id;
      const enclosingLabel = root.current?.closest('label');
      if (enclosingLabel) enclosingLabel.htmlFor = input.id;
      const attributes = { role: 'spinbutton', 'aria-label': label, 'aria-invalid': invalid, 'aria-describedby': describedBy,
        'aria-required': required, 'aria-valuemin': props.min, 'aria-valuemax': props.max,
        'aria-valuenow': props.value === '' ? undefined : props.value };
      for (const [key, value] of Object.entries(attributes)) {
        if (value === undefined) input.removeAttribute(key);
        else input.setAttribute(key, String(value));
      }
  });
  return <span ref={root} className="admin-number-input"><InputNumber theme="normal" {...props} /></span>;
}
