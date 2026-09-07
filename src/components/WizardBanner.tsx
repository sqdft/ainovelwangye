export type WizardStepView = {
  key: string;
  label: string;
  done: boolean;
  tab: string;
};

export function WizardBanner({
  steps,
  visible,
  onGo,
  onDismiss,
}: {
  steps: WizardStepView[];
  visible: boolean;
  onGo: (tab: string) => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  const doneCount = steps.filter(s => s.done).length;
  const current = steps.find(s => !s.done);
  return (
    <div className="mx-5 md:mx-8 mt-4 rounded-xl border border-[var(--ui-accent)]/30 bg-[var(--ui-accent-soft)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-[var(--ui-ink)]">
          新手向导 · {doneCount}/{steps.length}
          {current && <span className="ml-2 text-xs font-normal text-[var(--ui-muted)]">当前：{current.label}</span>}
        </div>
        <button
          type="button"
          className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
          onClick={onDismiss}
        >
          不再显示
        </button>
      </div>
      <div className="ui-progress-track mt-2">
        <div className="ui-progress-fill" style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }} />
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {steps.map((step, idx) => (
          <button
            key={step.key}
            type="button"
            onClick={() => onGo(step.tab)}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition ${
              step.done
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : idx === doneCount
                  ? 'border-[var(--ui-accent)] bg-white text-[var(--ui-accent-text)] font-semibold'
                  : 'border-[var(--ui-line)] bg-white/70 text-[var(--ui-muted)]'
            }`}
          >
            {step.done ? '✓ ' : `${idx + 1}. `}{step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
