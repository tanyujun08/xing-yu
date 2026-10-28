import { Link, type LinkProps } from 'tdesign-react';
import type { AnchorHTMLAttributes } from 'react';

// TDesign forwards anchor attributes but 1.18.2 omits these from LinkProps.
export function AdminLink(props: LinkProps & Pick<AnchorHTMLAttributes<HTMLAnchorElement>, 'rel' | 'download'>) {
  return <Link {...props} />;
}
