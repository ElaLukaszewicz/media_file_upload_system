import React, { useMemo } from 'react';
import styles from './HistoryItem.module.scss';

export interface HistoryItemData {
  id: string;
  name: string;
  size: number;
  type: string;
  completedAt: string;
}

export interface HistoryItemProps {
  item: HistoryItemData;
}

function HistoryItem({ item }: HistoryItemProps) {
  // Memoize calculations to avoid recalculation on every render
  const { sizeKb, completedLabel } = useMemo(() => {
    const completedDate = new Date(item.completedAt);
    return {
      sizeKb: Math.max(1, Math.round(item.size / 1024)),
      completedLabel: completedDate.toLocaleString(),
    };
  }, [item.size, item.completedAt]);

  return (
    <li className={styles.item} role="listitem">
      <div className={styles.itemRow}>
        <div>
          <h3 className={styles.fileName} id={`history-file-name-${item.id}`}>
            {item.name}
          </h3>
          <p className={styles.fileMeta} aria-describedby={`history-file-name-${item.id}`}>
            {sizeKb} KB • {item.type}
          </p>
        </div>
        <time
          className={styles.completedDate}
          dateTime={item.completedAt}
          aria-label={`Completed on ${completedLabel}`}
        >
          {completedLabel}
        </time>
      </div>
    </li>
  );
}

export default React.memo(HistoryItem);
