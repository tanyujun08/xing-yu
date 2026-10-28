import { useState } from 'react';
import { Input } from 'tdesign-react';
import type { ParsedInput } from './loyaltyInputs';

interface Props {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  parse: (value: string) => ParsedInput<unknown>;
  disabled?: boolean;
  submitted?: boolean;
  serverError?: string;
  hint?: string;
}

/** Keep the operator's text intact; conversion happens only in the shared parser. */
export function LoyaltyTextInput({ name, label, value, onChange, parse, disabled = false, submitted = false, serverError, hint }: Props) {
  const [visited, setVisited] = useState(false);
  const result = parse(value);
  const error = serverError ?? ((visited || submitted) && !result.ok ? result.message : undefined);
  return <div className="loyalty-text-field"><label><span>{label}</span>
    <Input name={name} type="text" value={value} disabled={disabled} status={error === undefined ? 'default' : 'error'}
      onChange={onChange} onBlur={() => setVisited(true)} /></label>
    {error === undefined ? hint === undefined ? null : <small>{hint}</small> : <small role="alert">{error}</small>}
  </div>;
}
