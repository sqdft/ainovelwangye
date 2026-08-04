export type ToastKind = 'info' | 'success' | 'error' | 'warn';

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  actionLabel?: string;
  actionTab?: string;
};

export function ToastStack({
  toasts,
  onDismiss,
  onAction,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
  onAction: (tab: string, id: number) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,22rem)] pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto ui-form-card !p-3 shadow-lg border ${
            t.kind === 'error'
              ? 'border-red-200'
              : t.kind === 'success'
                ? 'border-emerald-200'
                : t.kind === 'warn'
                  ? 'border-amber-200'
                  : 'border-[var(--ui-line)]'
          }`}
        >
          <div className="flex items-start gap-2">
            <p className="text-sm text-[var(--ui-ink)] flex-1 leading-snug">{t.message}</p>
            <button type="button" className="text-[var(--ui-muted)] text-xs shrink-0" onClick={() => onDismiss(t.id)}>
              关闭
            </button>
          </div>
          {t.actionTab && t.actionLabel && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-[var(--ui-accent-text)]"
              onClick={() => onAction(t.actionTab!, t.id)}
            >
              {t.actionLabel} →
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
