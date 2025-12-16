import React from 'react';
import { NavLink as RouterNavLink } from 'react-router-dom';
import styles from './NavLink.module.scss';

export interface NavLinkProps {
  to: string;
  /** Whether to match exactly */
  end: boolean;
  children: React.ReactNode;
}

function NavLink({ to, end, children }: NavLinkProps) {
  return (
    <RouterNavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [styles.navItem, isActive ? styles.navItemActive : ''].filter(Boolean).join(' ')
      }
    >
      {({ isActive }) => <span aria-current={isActive ? 'page' : undefined}>{children}</span>}
    </RouterNavLink>
  );
}

export default React.memo(NavLink);
