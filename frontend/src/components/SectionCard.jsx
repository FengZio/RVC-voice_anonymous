import React from 'react';
import styles from './SectionCard.module.css';

export function SectionCard({ title, description, icon, action, children, className = '' }) {
  return (
    <section className={`${styles.card} ${className}`}>
      <div className={styles.header}>
        <div className={styles.headingBlock}>
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        <div className={styles.meta}>
          {action}
          {icon ? <span className={styles.icon}>{icon}</span> : null}
        </div>
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
