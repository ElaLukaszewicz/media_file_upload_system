import { NavLink as RouterNavLink, type NavLinkProps } from 'react-router-dom';
import styles from './NavLink.module.scss';

type Props = Pick<NavLinkProps, 'to' | 'end' | 'children'>;

export function NavLink({ to, end, children }: Props) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.navItemActive : ''].filter(Boolean).join(' ')
      }
    >
      {children}
    </RouterNavLink>
  );
}
