import { useState } from 'react';
import { Check } from 'lucide-react';
import styles from './ReleaseUpdatesWidget.module.css';
import { LeafIcon } from '@/components/ui/Icons';
import { getReleaseUpdateContent, type ReleaseUpdateAudience } from '@/lib/release-updates';

interface Props {
  audience: ReleaseUpdateAudience;
}

/** Dashboard card that expands in place. The planner deliberately has no release pop-up. */
export default function ReleaseUpdatesWidget({ audience }: Props) {
  const content = getReleaseUpdateContent(audience);
  const [open, setOpen] = useState(false);

  return (
    <section className={styles.widget} aria-labelledby="release-widget-title">
      <div className={styles.header}>
        <div className={styles.icon} aria-hidden="true"><LeafIcon size={22} /></div>
        <div className={styles.body}>
          <p className={styles.eyebrow}>Planner-update</p>
          <h2 id="release-widget-title">Nieuw in de planner</h2>
          <p>Bekijk wat er voor jou is verbeterd.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-expanded={open}
          aria-controls="release-widget-items"
        >
          {open ? 'Verberg verbeteringen' : 'Bekijk verbeteringen'}
        </button>
      </div>

      {open && (
        <div id="release-widget-items" className={styles.details}>
          <p className={styles.intro}>{content.intro}</p>
          <ul className={styles.list}>
            {content.items.map(item => (
              <li key={item.title} className={styles.item}>
                <span className={styles.check} aria-hidden="true"><Check size={18} /></span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
