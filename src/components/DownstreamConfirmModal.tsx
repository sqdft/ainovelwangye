import type { DownstreamLevel } from '../orchestration';
import { downstreamImpactLabel } from '../orchestration';

export type DownstreamConfirmState = {
  title: string;
  detail?: string;
  preferredLevel: DownstreamLevel;
  apply: () => void;
} | null;

const OPTIONS: { level: DownstreamLevel; label: string; desc: string }[] = [
  { level: 'chapters', label: '仅正文', desc: '只清空已生成章节与全书记忆，保留人物/目录' },
  { level: 'toc', label: '目录 + 正文', desc: '清空境界推进、目录、正文与记忆，保留书名设定与人物' },
  { level: 'book', label: '全下游', desc: '人物、境界、目录、正文、记忆全部清空' },
];

export function DownstreamConfirmModal({
  state,
  onCancel,
  onConfirm,
}: {
  state: DownstreamConfirmState;
  onCancel: () => void;
  onConfirm: (level: DownstreamLevel) => void;
}) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]">
      <div className="ui-form-card w-full max-w-md !p-5 shadow-2xl border border-[var(--ui-line)]">
        <h3 className="text-base font-semibold text-[var(--ui-ink)]">修改设定 · 选择清理范围</h3>
        <p className="text-sm text-[var(--ui-muted)] mt-2 leading-relaxed">{state.title}</p>
        {state.detail && <p className="text-xs text-[var(--ui-muted)] mt-1">{state.detail}</p>}
        <div className="mt-4 space-y-2">
          {OPTIONS.map(opt => (
            <button
              key={opt.level}
              type="button"
              onClick={() => onConfirm(opt.level)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition ${
                state.preferredLevel === opt.level
                  ? 'border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]'
                  : 'border-[var(--ui-line)] bg-white/80 hover:border-[var(--ui-accent)]/40'
              }`}
            >
              <div className="text-sm font-semibold text-[var(--ui-ink)]">{opt.label}</div>
              <div className="text-[11px] text-[var(--ui-muted)] mt-0.5">{opt.desc}</div>
              <div className="text-[10px] text-[var(--ui-muted)] mt-1">将清空：{downstreamImpactLabel(opt.level)}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="ui-btn-secondary text-sm" onClick={onCancel}>
            取消修改
          </button>
        </div>
      </div>
    </div>
  );
}
