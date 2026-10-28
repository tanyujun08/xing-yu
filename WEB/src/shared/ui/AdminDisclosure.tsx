import { useId, useState, type ReactNode } from 'react';
import { Button, Collapse } from 'tdesign-react';
import { ChevronDownIcon, ChevronRightIcon } from 'tdesign-icons-react';

export function AdminDisclosure({ title, children, className = '' }: { title: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <Collapse className={className} value={open ? ['content'] : []} expandIcon={false} expandOnRowClick={false}>
    <Collapse.Panel value="content" header={<Button tag="button" type="button" variant="text"
      aria-expanded={open} aria-controls={id} icon={open ? <ChevronDownIcon /> : <ChevronRightIcon />}
      onClick={() => setOpen((value) => !value)}>{title}</Button>}>
      <div id={id} hidden={!open}>{children}</div>
    </Collapse.Panel>
  </Collapse>;
}
