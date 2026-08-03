import { useEffect, useMemo, useState } from 'react';
import styles from './DashboardWidgetLayout.module.css';

export interface DashboardWidgetDefinition<WidgetId extends string> {
  id: WidgetId;
  label: string;
  content: React.ReactNode;
  fullWidth?: boolean;
}

interface StoredLayout<WidgetId extends string> {
  version: 1;
  visible: WidgetId[];
}

interface Props<WidgetId extends string> {
  storageKey: string;
  widgets: DashboardWidgetDefinition<WidgetId>[];
  defaultOrder: WidgetId[];
  className?: string;
  emptyText?: string;
}

function isStoredLayout(value: unknown): value is StoredLayout<string> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredLayout<string>>;
  return candidate.version === 1 && Array.isArray(candidate.visible);
}

/**
 * Versioned, local dashboard layout. Old array-only admin preferences are
 * migrated without losing their order; newly introduced widgets are appended.
 */
export default function DashboardWidgetLayout<WidgetId extends string>({
  storageKey,
  widgets,
  defaultOrder,
  className,
  emptyText = 'Je hebt nu geen widgets op je dashboard.',
}: Props<WidgetId>) {
  const availableSignature = widgets.map((widget) => widget.id).join('\u0000');
  const availableIds = useMemo(
    () => availableSignature.split('\u0000').filter(Boolean) as WidgetId[],
    [availableSignature]
  );
  const [visible, setVisible] = useState<WidgetId[]>(defaultOrder);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (isStoredLayout(parsed)) {
        setVisible(
          parsed.visible.filter(
            (id, index): id is WidgetId =>
              availableIds.includes(id as WidgetId) && parsed.visible.indexOf(id) === index
          )
        );
        return;
      }

      if (Array.isArray(parsed)) {
        const legacy = parsed.filter(
          (id, index): id is WidgetId =>
            typeof id === 'string' &&
            availableIds.includes(id as WidgetId) &&
            parsed.indexOf(id) === index
        );
        setVisible([...legacy, ...defaultOrder.filter((id) => !legacy.includes(id))]);
      }
    } catch {
      // Een kapotte of geblokkeerde lokale opslag mag het dashboard niet blokkeren.
    } finally {
      setReady(true);
    }
  }, [availableIds, defaultOrder, storageKey]);

  const save = (next: WidgetId[]) => {
    setVisible(next);
    try {
      const payload: StoredLayout<WidgetId> = { version: 1, visible: next };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // De keuze blijft in deze sessie actief als opslag niet beschikbaar is.
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= visible.length || from === to) return;
    const next = [...visible];
    const [widget] = next.splice(from, 1);
    next.splice(to, 0, widget);
    save(next);
  };

  const hiddenWidgets = widgets.filter((widget) => !visible.includes(widget.id));
  const visibleWidgets = visible
    .map((id) => widgets.find((widget) => widget.id === id))
    .filter((widget): widget is DashboardWidgetDefinition<WidgetId> => Boolean(widget));

  return (
    <section className={`${styles.layout}${className ? ` ${className}` : ''}`} aria-label="Dashboardwidgets">
      <div className={styles.toolbar}>
        {editing ? (
          <p>Pas je dashboard aan. Je keuze wordt automatisch bewaard.</p>
        ) : (
          <span />
        )}
        <div className={styles.toolbarActions}>
          {editing && (
            <button type="button" onClick={() => save(defaultOrder)}>
              Standaard herstellen
            </button>
          )}
          <button type="button" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
            {editing ? 'Klaar' : 'Dashboard indelen'}
          </button>
        </div>
      </div>

      {editing && hiddenWidgets.length > 0 && (
        <div className={styles.addPanel} aria-label="Widgets toevoegen">
          <strong>Widget toevoegen</strong>
          <div>
            {hiddenWidgets.map((widget) => (
              <button key={widget.id} type="button" onClick={() => save([...visible, widget.id])}>
                + {widget.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleWidgets.length === 0 ? (
        <div className={styles.empty} role="status">
          <p>{emptyText}</p>
          {hiddenWidgets.length > 0 && !editing && (
            <button type="button" onClick={() => setEditing(true)}>
              Widget toevoegen
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid} data-ready={ready ? 'true' : 'false'}>
          {visibleWidgets.map((widget, index) => (
            <article
              key={widget.id}
              className={styles.widget}
              data-full-width={widget.fullWidth ? 'true' : 'false'}
              data-editing={editing ? 'true' : 'false'}
            >
              {editing && (
                <div className={styles.widgetControls}>
                  <strong>{widget.label}</strong>
                  <div>
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`${widget.label} omhoog verplaatsen`}
                      onClick={() => move(index, index - 1)}
                    >
                      Omhoog
                    </button>
                    <button
                      type="button"
                      disabled={index === visibleWidgets.length - 1}
                      aria-label={`${widget.label} omlaag verplaatsen`}
                      onClick={() => move(index, index + 1)}
                    >
                      Omlaag
                    </button>
                    <button
                      type="button"
                      className={styles.removeButton}
                      aria-label={`${widget.label} van dashboard verwijderen`}
                      onClick={() => save(visible.filter((id) => id !== widget.id))}
                    >
                      Verwijder
                    </button>
                  </div>
                </div>
              )}
              <div className={styles.content}>{widget.content}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
