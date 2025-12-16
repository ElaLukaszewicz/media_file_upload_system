import { useEffect, useState } from 'react';
import { HistoryItem } from '../components';
import { loadUploadHistory, type UploadHistoryItem } from '../utils/uploadHistory';
import styles from './History.module.scss';

export default function HistoryPage() {
  const [historyItems, setHistoryItems] = useState<UploadHistoryItem[]>([]);

  useEffect(() => {
    const stored = loadUploadHistory();
    setHistoryItems(stored);
  }, []);

  const hasHistory = historyItems.length > 0;

  if (!hasHistory) {
    return <p>No uploads yet.</p>;
  }

  return (
    <section aria-labelledby="history-heading">
      <header>
        <h2 id="history-heading">Upload history</h2>
        <p>Shows completed uploads stored locally in this browser.</p>
      </header>
      <ul className={styles.uploadList} aria-label="Completed uploads">
        {historyItems.map((item) => (
          <HistoryItem key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
