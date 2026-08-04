import { Loader2 } from 'lucide-react';
import type { ProviderProfile } from '../../types';
import type { TaskState } from '../../orchestration';

export function AppHeader({
  title,
  realmTitle,
  activeTab,
  mode,
  taskState,
  isBatchGenerating,
  providerProfiles,
  activeProfileId,
  bookTitle,
  shortTitle,
  chapterWritten,
  chapterTarget,
  onActivateProfile,
  onCancelTask,
  onRetryTask,
  onClearTask,
}: {
  title?: string;
  realmTitle?: string;
  activeTab: string;
  mode: 'novel' | 'shortStory';
  taskState: TaskState;
  isBatchGenerating: boolean;
  providerProfiles: ProviderProfile[];
  activeProfileId: string | null;
  bookTitle?: string;
  shortTitle?: string;
  chapterWritten: number;
  chapterTarget: number;
  onActivateProfile: (p: ProviderProfile) => void;
  onCancelTask: () => void;
  onRetryTask: () => void;
  onClearTask: () => void;
}) {
  const pageTitle =
    activeTab === 'settings'
      ? '系统设置'
      : activeTab === 'book'
        ? mode === 'novel'
          ? '书籍信息'
          : '短篇设定'
        : activeTab === 'characters'
          ? '人物关系'
          : activeTab === 'realms'
            ? realmTitle || '境界体系'
            : activeTab === 'toc'
              ? '大纲目录'
              : activeTab === 'chapters'
                ? mode === 'novel'
                  ? '章节正文'
                  : '故事正文'
                : activeTab === 'examples'
                  ? '范文参考'
                  : activeTab === 'memory'
                    ? '作品记忆'
                    : '';

  return (
    <header className="ui-header">
      <div className="min-w-0">
        <h2 className="font-semibold text-[var(--ui-ink)] text-[15px] truncate">{pageTitle}</h2>
        {taskState.status !== 'idle' && (
          <p
            className={`text-[11px] mt-0.5 truncate ${
              taskState.status === 'error' ? 'text-red-600' : 'text-[var(--ui-muted)]'
            }`}
          >
            {taskState.status === 'running' && (taskState.label || '任务进行中…')}
            {taskState.status === 'error' && (taskState.lastError ? `失败：${taskState.lastError}` : '任务失败')}
            {taskState.progress && taskState.status === 'running' && (
              <span className="tabular-nums">
                {' '}
                · {taskState.progress.current}/{taskState.progress.total}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex-1 min-w-0" />
      {providerProfiles.length > 0 && (
        <select
          value={activeProfileId || ''}
          onChange={e => {
            const p = providerProfiles.find(x => x.id === e.target.value);
            if (p) onActivateProfile(p);
          }}
          className="hidden md:block text-xs ui-input !py-1 !px-2 max-w-[10rem] shrink-0"
          title="切换供应商卡片"
        >
          <option value="" disabled>
            供应商卡片
          </option>
          {providerProfiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {(bookTitle || shortTitle) && (
        <span className="hidden sm:inline text-sm text-[var(--ui-muted)] truncate max-w-[10rem]">
          {mode === 'novel' ? bookTitle : shortTitle}
        </span>
      )}
      {mode === 'novel' && chapterTarget > 0 && (
        <span className="text-xs tabular-nums shrink-0 font-semibold text-[var(--ui-accent-text)] bg-[var(--ui-accent-soft)] px-2.5 py-1 rounded-full border border-[var(--ui-accent)]/15">
          {chapterWritten}/{chapterTarget} 章
        </span>
      )}
      {taskState.status === 'running' && (
        <span className="ui-status-pill shrink-0">
          <Loader2 className="w-3 h-3 animate-spin" />
          {taskState.kind === 'batch' ? '批量中' : '生成中'}
        </span>
      )}
      {taskState.status === 'running' && (taskState.cancellable || isBatchGenerating) && (
        <button
          type="button"
          onClick={onCancelTask}
          className="text-xs px-2 py-1 rounded-lg border border-amber-200 text-amber-800 bg-amber-50 shrink-0"
        >
          停止
        </button>
      )}
      {taskState.status === 'error' && (
        <button
          type="button"
          onClick={onRetryTask}
          className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50 shrink-0"
        >
          重试
        </button>
      )}
      {taskState.status === 'error' && (
        <button type="button" onClick={onClearTask} className="text-xs text-[var(--ui-muted)] shrink-0">
          清除
        </button>
      )}
    </header>
  );
}
