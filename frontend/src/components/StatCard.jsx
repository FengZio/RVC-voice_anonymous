import React from 'react';
import styles from './StatCard.module.css';

export function StatCard({ label, value, hint, icon }) {
  return (
    <article className={styles.card}>
      <div className={styles.topRow}>
        <span className={styles.label}>{label}</span>
        {icon ? <span className={styles.iconWrap}>{icon}</span> : null}
      </div>
      <strong className={styles.value}>{value}</strong>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </article>
  );
}
