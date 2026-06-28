import React from 'react';
import styles from './StatusBadge.module.css';

const toneClass = {
  neutral: styles.neutral,
  accent: styles.accent,
  success: styles.success,
  warning: styles.warning,
  danger: styles.danger,
};

export function StatusBadge({ tone = 'neutral', children }) {
  return <span className={`${styles.badge} ${toneClass[tone] || toneClass.neutral}`}>{children}</span>;
}
