import type { ChapterDraft } from '../types';

export function MultiDraftModal({
  open,
  chapterNum,
  drafts,
  onClose,
  onPick,
}: {
  open: boolean;
  chapterNum: number | null;
  drafts: ChapterDraft[];
  onClose: () => void;
  onPick: (draft: ChapterDraft) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[2px]">
      <div className="ui-form-card w-full max-w-6xl !p-5 shadow-2xl border border-[var(--ui-line)] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--ui-ink)]">
            第 {chapterNum ?? '?'} 章 · 多稿对比（{drafts.length} 版）
          </h3>
          <button type="button" className="ui-btn-secondary text-sm" onClick={onClose}>
            关闭
          </button>
        </div>
        <p className="text-xs text-[var(--ui-muted)] mt-1">
          三个版本用不同创作侧重各写一遍，选定后覆盖本章（原稿已存入版本历史）。
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4 overflow-y-auto">
          {drafts.map((draft, idx) => (
            <div key={draft.id} className="rounded-xl border border-[var(--ui-line)] bg-white/85 p-3 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--ui-accent-text)]">版本 {idx + 1} · {draft.angle}</span>
                <span className="text-[10px] tabular-nums text-[var(--ui-muted)]">{draft.words} 字</span>
              </div>
              <div className="mt-2 flex-1 max-h-72 overflow-y-auto rounded-lg bg-black/[0.03] p-2.5">
                <p className="text-xs leading-relaxed whitespace-pre-wrap text-[var(--ui-ink)]">
                  {draft.content.slice(0, 2200)}
                  {draft.content.length > 2200 ? '\n……（预览截断，选定后查看全文）' : ''}
                </p>
              </div>
              <button
                type="button"
                className="ui-btn-primary text-sm mt-3"
                onClick={() => onPick(draft)}
              >
                选定此稿
              </button>
            </div>
          ))}
          {drafts.length === 0 && (
            <p className="text-sm text-[var(--ui-muted)] col-span-full text-center py-8">正在生成多稿…</p>
          )}
        </div>
      </div>
    </div>
  );
}
