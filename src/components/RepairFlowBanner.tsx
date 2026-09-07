import { Loader2 } from 'lucide-react';
import type { RepairFlowState } from '../types';

export function RepairFlowBanner({
  state,
  busy,
  onToggle,
  onSelectAll,
  onRun,
  onStop,
  onDismiss,
  onGoChapter,
}: {
  state: RepairFlowState;
  busy: boolean;
  onToggle: (chapterNumber: number) => void;
  onSelectAll: (selected: boolean) => void;
  onRun: () => void;
  onStop: () => void;
  onDismiss: () => void;
  onGoChapter: (chapterNumber: number) => void;
}) {
  const selectedCount = state.tasks.filter(t => t.selected && !t.done).length;
  const doneCount = state.tasks.filter(t => t.done).length;
  const fieldName = state.field === 'outline' ? '大纲' : '世界观';

  return (
    <div className="mx-5 md:mx-8 mt-4 rounded-xl border border-amber-300/60 bg-amber-50/90 px-4 py-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm font-semibold text-amber-900 flex items-center gap-2">
          {state.status === 'analyzing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {state.status === 'analyzing' && `已应用新的${fieldName}，AI 正在分析需要修复的章节…`}
          {state.status === 'review' && `AI 判断 ${state.tasks.length} 章受${fieldName}变更影响，请确认修复清单`}
          {state.status === 'repairing' && `正在逐章修复（${Math.min(state.currentIndex, doneCount + 1)}/${state.tasks.filter(t => t.selected).length}）· 每章完成即保存，原稿自动存档`}
          {state.status === 'done' && `修复流程结束：完成 ${doneCount}/${state.tasks.filter(t => t.selected).length} 章，原稿在章节「历史版本」中可回滚`}
        </div>
        <div className="flex items-center gap-2">
          {state.status === 'review' && (
            <>
              <button type="button" className="ui-btn-secondary text-xs" onClick={() => onSelectAll(true)}>全选</button>
              <button type="button" className="ui-btn-secondary text-xs" onClick={() => onSelectAll(false)}>全不选</button>
              <button
                type="button"
                className="ui-btn-primary text-xs disabled:opacity-50"
                disabled={busy || selectedCount === 0}
                onClick={onRun}
              >
                开始逐步修复（{selectedCount}）
              </button>
              <button type="button" className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={onDismiss}>
                放弃
              </button>
            </>
          )}
          {state.status === 'repairing' && (
            <button type="button" className="ui-btn-secondary text-xs" onClick={onStop}>
              完成当前章后停止
            </button>
          )}
          {(state.status === 'done' || state.status === 'repairing') && (
            <button type="button" className="text-xs text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={onDismiss}>
              {state.status === 'done' ? '关闭' : '收起面板（后台继续）'}
            </button>
          )}
        </div>
      </div>
      {state.status === 'review' && state.tasks.length > 0 && (
        <div className="mt-2 max-h-44 overflow-y-auto divide-y divide-amber-200/70">
          {state.tasks.map(task => (
            <label key={task.chapterNumber} className="flex items-start gap-2 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={task.selected}
                onChange={() => onToggle(task.chapterNumber)}
              />
              <span className="text-xs text-amber-900 leading-relaxed">
                <button
                  type="button"
                  className="font-semibold underline decoration-dotted"
                  onClick={e => { e.preventDefault(); onGoChapter(task.chapterNumber); }}
                >
                  第{task.chapterNumber}章
                </button>
                ：{task.reason}
              </span>
            </label>
          ))}
        </div>
      )}
      {state.status === 'review' && state.tasks.length === 0 && (
        <p className="text-xs text-amber-900 mt-2">AI 未发现需要修复的章节，本次修改无需动正文。</p>
      )}
      {state.status === 'repairing' && (
        <div className="ui-progress-track mt-2">
          <div
            className="ui-progress-fill"
            style={{ width: `${Math.round((doneCount / Math.max(state.tasks.filter(t => t.selected).length, 1)) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
