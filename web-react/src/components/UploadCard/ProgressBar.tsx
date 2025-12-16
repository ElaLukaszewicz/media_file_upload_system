import React from 'react';
import styles from './ProgressBar.module.scss';

export interface ProgressBarProps {
  percent: number;
  'aria-label'?: string;
}

export const ProgressBar = React.memo(function ProgressBar({
  percent,
  'aria-label': ariaLabel,
}: ProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-valuenow={clampedPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${clampedPercent} percent`}
      aria-label={ariaLabel || `Progress: ${clampedPercent}%`}
    >
      <div
        className={styles.progressFill}
        style={{ width: `${clampedPercent}%` }}
        aria-hidden="true"
      />
    </div>
  );
});
