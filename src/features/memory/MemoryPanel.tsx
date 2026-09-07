import type { NovelMemory } from '../../types';
import type { ReactNode } from 'react';

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ui-memory-card">
      <header className="ui-memory-card__head">{title}</header>
      <div className="ui-memory-card__body">{children}</div>
    </section>
  );
}

export function MemoryPanel({
  novelMemory,
  setNovelMemory,
  editable,
  setEditable,
}: {
  novelMemory: NovelMemory;
  setNovelMemory: (v: NovelMemory | ((p: NovelMemory) => NovelMemory)) => void;
  editable: boolean;
  setEditable: (v: boolean) => void;
}) {
  const empty = (text: string) => (
    <p className="text-sm text-[var(--ui-muted)] leading-relaxed min-h-[2.5rem]">{text}</p>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      <div className="ui-memory-card !p-0 overflow-hidden">
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--ui-line)] bg-white/55">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--ui-ink)] tracking-tight">作品记忆</h2>
            <p className="text-sm text-[var(--ui-muted)] mt-1.5 leading-relaxed max-w-xl">
              章后自动更新。可先查看；开启编辑后手动修正，避免后续章节跑偏。
            </p>
            <p className="text-xs text-[var(--ui-muted)] mt-1.5 tabular-nums">
              最近更新到第 {novelMemory.lastUpdatedChapter || 0} 章
            </p>
          </div>
          <button
            type="button"
            className={editable ? 'ui-btn-primary text-sm shrink-0' : 'ui-btn-secondary text-sm shrink-0'}
            onClick={() => setEditable(!editable)}
          >
            {editable ? '完成编辑' : '允许手改'}
          </button>
        </div>
      </div>

      <Section title="故事进展">
        {editable ? (
          <textarea
            className="ui-input w-full min-h-[8rem]"
            value={novelMemory.storySoFar || ''}
            onChange={e => setNovelMemory({ ...novelMemory, storySoFar: e.target.value })}
            placeholder="主线进展、时间线、关键转折…"
          />
        ) : novelMemory.storySoFar ? (
          <p className="text-sm text-[var(--ui-ink)] whitespace-pre-wrap leading-relaxed">
            {novelMemory.storySoFar}
          </p>
        ) : (
          empty('（暂无）')
        )}
      </Section>

      <Section title="人物状态">
        {editable ? (
          <textarea
            className="ui-input w-full min-h-[6rem]"
            value={novelMemory.characterStates || ''}
            onChange={e => setNovelMemory({ ...novelMemory, characterStates: e.target.value })}
            placeholder="各角色当前位置、立场、伤势等…"
          />
        ) : novelMemory.characterStates ? (
          <p className="text-sm text-[var(--ui-ink)] whitespace-pre-wrap leading-relaxed">
            {novelMemory.characterStates}
          </p>
        ) : (
          empty('（暂无）')
        )}
      </Section>

      <div className="grid sm:grid-cols-2 gap-3">
        <Section title="未回收线索 / 伏笔">
          {editable ? (
            <textarea
              className="ui-input w-full min-h-[6rem]"
              value={(novelMemory.openThreads || []).join('\n')}
              onChange={e =>
                setNovelMemory({
                  ...novelMemory,
                  openThreads: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                })
              }
              placeholder="每行一条"
            />
          ) : (novelMemory.openThreads || []).length > 0 ? (
            <ul className="text-sm space-y-1.5 list-disc pl-4 text-[var(--ui-ink)]">
              {(novelMemory.openThreads || []).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            empty('（无）')
          )}
        </Section>
        <Section title="已解决线索">
          {editable ? (
            <textarea
              className="ui-input w-full min-h-[6rem]"
              value={(novelMemory.resolvedThreads || []).join('\n')}
              onChange={e =>
                setNovelMemory({
                  ...novelMemory,
                  resolvedThreads: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                })
              }
              placeholder="每行一条"
            />
          ) : (novelMemory.resolvedThreads || []).length > 0 ? (
            <ul className="text-sm space-y-1.5 list-disc pl-4 text-[var(--ui-ink)]">
              {(novelMemory.resolvedThreads || []).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          ) : (
            empty('（无）')
          )}
        </Section>
      </div>

      <Section title="重要物品 / 设定">
        {editable ? (
          <textarea
            className="ui-input w-full min-h-[5rem]"
            value={(novelMemory.importantItems || []).join('\n')}
            onChange={e =>
              setNovelMemory({
                ...novelMemory,
                importantItems: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
              })
            }
            placeholder="每行一条"
          />
        ) : (novelMemory.importantItems || []).length > 0 ? (
          <ul className="text-sm space-y-1.5 list-disc pl-4 text-[var(--ui-ink)]">
            {(novelMemory.importantItems || []).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          empty('（无）')
        )}
      </Section>
    </div>
  );
}
