import { UploadCard } from '../components/UploadCard';
import { useUploadContext } from '../state/uploadContext';
import styles from './History.module.scss';

export default function HistoryPage() {
  const { state } = useUploadContext();
  const completed = state.items.filter((item) => item.status === 'completed');

  if (!completed.length) {
    return <p>No uploads yet.</p>;
  }

  return (
    <section className={styles.sectionCard}>
      <header>
        <h2>Upload history</h2>
        <p>Shows completed uploads; API/storage to be added later.</p>
      </header>
      <ul className={styles.uploadList}>
        {completed.map((item) => (
          <UploadCard key={item.file.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
