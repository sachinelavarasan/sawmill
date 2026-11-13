import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { NAV_ITEMS } from '../nav';
import { Icon, LangToggle, ThemeToggle } from './ui';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, can } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((n) => can(n.permission));
  const isOwner = user?.role === 'OWNER';

  const link = (n: (typeof items)[number]) => (
    <NavLink
      key={n.path}
      to={n.path}
      end={n.path === '/'}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={() => setOpen(false)}
    >
      <span className="nav-icon">
        <Icon name={n.icon} />
      </span>
      <span className="nav-label">{t(n.labelKey)}</span>
      {n.phase && <span className="nav-phase">P{n.phase}</span>}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">SP</div>
          <div>
            <div className="brand-name">SAWMILL PRO</div>
            <div className="brand-sub">{user?.mill.name}</div>
          </div>
        </div>
        <nav aria-label={t('menu')}>
          {items.filter((n) => n.section === 'main').map(link)}
          {isOwner && <div className="nav-section">{t('ownerOnly')}</div>}
          {items.filter((n) => n.section === 'owner').map(link)}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label={t('menu')} onClick={() => setOpen((o) => !o)}>
            <Icon name="menu" />
          </button>
          <div className="topbar-spacer" />
          <ThemeToggle />
          <LangToggle />
          <div className="user-chip">
            <div className="avatar">{user?.name.charAt(0).toUpperCase()}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name}</div>
              <div className={`role-badge ${isOwner ? 'owner' : 'accountant'}`}>
                {isOwner ? t('owner') : t('accountant')}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost logout-btn" onClick={logout} aria-label={t('logout')} title={t('logout')}>
            <Icon name="logout" size={18} />
            <span className="btn-label">{t('logout')}</span>
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
