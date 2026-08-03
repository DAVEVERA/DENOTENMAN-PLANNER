import styles from './ReleaseUpdatesWidget.module.css';
import { LeafIcon } from '@/components/ui/Icons';

interface Props {
  onOpen: () => void;
}

/** Compact dashboard entry point; detailed, role-specific copy stays in the pop-out. */
export default function ReleaseUpdatesWidget({ onOpen }: Props) {
  return (
    <section className={styles.widget} aria-labelledby="release-widget-title">
      <div className={styles.icon} aria-hidden="true"><LeafIcon size={22} /></div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>Planner-update</p>
        <h2 id="release-widget-title">Nieuw in de planner</h2>
        <p>Bekijk wat er voor jou is verbeterd.</p>
      </div>
      <button type="button" onClick={onOpen}>
        Bekijk verbeteringen
      </button>
    </section>
  );
}
