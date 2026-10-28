import { Link, type LinkProps } from 'tdesign-react';
import { useHref, useLinkClickHandler, type To } from 'react-router-dom';

type Props = Omit<LinkProps, 'href'> & { to: To; replace?: boolean; state?: unknown };

// TDesign owns the visual control; React Router keeps SPA navigation, modifier
// clicks and real hrefs for copying/opening a link in another tab.
export function AdminRouteLink({ to, replace = false, state, target = '_self', onClick, ...props }: Props) {
  const href = useHref(to);
  const navigate = useLinkClickHandler<HTMLAnchorElement>(to, { replace, state, target });
  return <Link {...props} href={href} target={target} onClick={(event) => {
    onClick?.(event);
    if (!event.defaultPrevented) navigate(event);
  }} />;
}
