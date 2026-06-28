import React from 'react';
import { ChevronRight, HeartPulse, LogOut } from 'lucide-react';
import { StatusBadge } from './StatusBadge.jsx';
import styles from './WorkspaceShell.module.css';

export function WorkspaceShell({
  title,
  subtitle,
  roleLabel,
  user,
  navItems,
  activeKey,
  onNavigate,
  onLogout,
  sidebarTop,
  sidebarFooter,
  toolbar,
  children,
}) {
  const displayName = user?.displayName || user?.username || '用户';

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <HeartPulse size={18} />
          </div>
          <div className={styles.headerCopy}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <StatusBadge tone="neutral">{roleLabel}</StatusBadge>
          <StatusBadge tone="accent">{displayName}</StatusBadge>
          {toolbar}
          <button className={styles.logoutButton} type="button" onClick={onLogout}>
            <LogOut size={16} />
            退出
          </button>
        </div>
      </header>

      <section className={styles.inner}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            {sidebarTop}
          </div>

          <div className={styles.sidebarCard}>
            <nav className={styles.navList} aria-label="工作台导航">
              {navItems.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`${styles.navButton} ${isActive ? styles.navButtonActive : ''}`}
                    onClick={() => onNavigate(item.key)}
                  >
                    <item.icon size={16} />
                    <span className={styles.navLabel}>
                      <strong className={styles.navTitle}>{item.label}</strong>
                      <small className={styles.navHint}>{item.hint}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </nav>
          </div>

          {sidebarFooter ? <div className={styles.sidebarCard}>{sidebarFooter}</div> : null}
        </aside>

        <section className={styles.content}>
          {children}
        </section>
      </section>
    </main>
  );
}
