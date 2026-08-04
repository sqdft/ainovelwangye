import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Feather,
  FileText,
  List,
  Loader2,
  Play,
  RefreshCw,
  Wand2,
} from 'lucide-react';
import type { ShortStoryInfo, TOCItem } from '../../types';
import { SHORT_STORY_THEME_NAMES } from '../../config/themes';

export type ChaptersPanelProps = {
  mode: 'novel' | 'shortStory';
  // short
  shortStoryInfo: ShortStoryInfo;
  setShortStoryInfo: (v: ShortStoryInfo | ((p: ShortStoryInfo) => ShortStoryInfo)) => void;
  setShortStoryTitleOptions: (v: string[]) => void;
  showShortResetMenu: boolean;
  setShowShortResetMenu: (v: boolean | ((p: boolean) => boolean)) => void;
  chapterReadMode: boolean;
  setChapterReadMode: (v: boolean) => void;
  // novel
  toc: TOCItem[];
  chapters: Record<number, string>;
  setChapters: (v: Record<number, string> | ((p: Record<number, string>) => Record<number, string>)) => void;
  activeChapterNum: number | null;
  setActiveChapterNum: (n: number | null) => void;
  chapterQualityNotes: Record<number, string[]>;
  setChapterQualityNotes: (
    v: Record<number, string[]> | ((p: Record<number, string[]>) => Record<number, string[]>)
  ) => void;
  batchFailedChapters: number[];
  // task
  isTaskBusy: boolean;
  isGenerating: boolean;
  isBatchGenerating: boolean;
  generatingChapterNum: number | null;
  // actions
  onGenerateShort: (opts: { segmentIndex?: number; rewrite?: boolean; forceFinal?: boolean }) => void;
  onGenerateChapter: (n: number, opts?: { mode?: string; directive?: string; stream?: boolean }) => void;
  onChapterAction?: (n: number, opts: { mode?: string; directive?: string; stream?: boolean }) => void;
  onDeleteChapter: (n: number) => void;
  onBatchGenerate: (opts?: { onlyFailed?: boolean }) => void;
  onStopBatch: () => void;
  onFillMissingChapters?: () => void;
  onRewriteByQuality?: (n: number) => void;
  onPipelineToToc?: () => void;
  minWordCount?: number;
  targetChapterCount?: number;
};

export function ChaptersPanel(props: ChaptersPanelProps) {
  const {
    mode,
    shortStoryInfo,
    setShortStoryInfo,
    setShortStoryTitleOptions,
    showShortResetMenu,
    setShowShortResetMenu,
    chapterReadMode,
    setChapterReadMode,
    toc,
    chapters,
    setChapters,
    activeChapterNum,
    setActiveChapterNum,
    chapterQualityNotes,
    setChapterQualityNotes,
    batchFailedChapters,
    isTaskBusy,
    isGenerating,
    isBatchGenerating,
    generatingChapterNum,
    onGenerateShort,
    onGenerateChapter,
    onChapterAction,
    onDeleteChapter,
    onBatchGenerate,
    onStopBatch,
    onFillMissingChapters,
    onRewriteByQuality,
    onPipelineToToc,
    minWordCount = 2000,
    targetChapterCount = 0,
  } = props;

  const [rewriteDirective, setRewriteDirective] = useState('');

  const shortWordCount = (shortStoryInfo.content || '').replace(/\s/g, '').length;
  const shortTarget = Math.max(shortStoryInfo.targetWordCount || 10000, 1);
  const shortNearEnd = shortWordCount >= shortTarget * 0.9;
  const activeContent = activeChapterNum != null ? (chapters[activeChapterNum] || '') : '';
  const activeWordCount = activeContent.replace(/\s/g, '').length;
  const writtenCount = Object.keys(chapters).length;
  const missingCount = toc.filter(t => !chapters[t.chapterNumber]).length;



    if (mode === 'shortStory') {
      return (
        <div className="h-full min-h-0 max-w-5xl mx-auto w-full rounded-xl border border-stone-200 bg-white shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-white shrink-0 gap-2 flex-wrap">
            <h3 className="font-semibold text-lg text-[var(--ui-ink)]">
              {shortStoryInfo.title || '未命名短篇'}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowShortResetMenu(v => !v)}
                  className="ui-btn-secondary"
                >
                  <RefreshCw className="w-4 h-4" />
                  重置
                  <ChevronDown className={`w-3 h-3 transition-transform ${showShortResetMenu ? 'rotate-180' : ''}`} />
                </button>
                {showShortResetMenu && (
                  <div className="ui-menu right-0 top-full mt-1 w-48">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('确定要清空当前正文内容吗？保留标题和大纲。')) {
                          setShortStoryInfo({ ...shortStoryInfo, content: '', currentSegment: 0, segments: (shortStoryInfo.segments || []).map(s => ({ ...s, content: '', isGenerated: false })) });
                          setShowShortResetMenu(false);
                        }
                      }}
                      className="ui-menu-item"
                    >
                      仅清空正文
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('确定要重置整个故事吗？这将清空标题、大纲、正文等所有内容，但保留API设置。')) {
                          setShortStoryInfo({
                            title: '',
                            themes: [SHORT_STORY_THEME_NAMES[0]],
                            targetWordCount: 10000,
                            outline: '',
                            content: '',
                            segments: [],
                            currentSegment: 0,
                            isOutlineGenerated: false
                          });
                          setShortStoryTitleOptions([]);
                          setShowShortResetMenu(false);
                        }
                      }}
                      className="ui-menu-item text-red-600 hover:bg-red-50"
                    >
                      重置所有故事信息
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => onGenerateShort({})}
                  disabled={isTaskBusy || (!shortStoryInfo.outline && !(shortStoryInfo.segments?.length))}
                  className="ui-btn-primary disabled:opacity-70"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {shortStoryInfo.segments?.length
                    ? ((shortStoryInfo.segments.findIndex(s => !s.isGenerated) < 0)
                      ? '全部分段已写完'
                      : `生成当前段：${shortStoryInfo.segments.find(s => !s.isGenerated)?.title || '下一段'}`)
                    : (shortStoryInfo.content ? '继续写' : '开始生成')}
                </button>
                {!!shortStoryInfo.content && (
                  <button
                    onClick={() => onGenerateShort({ forceFinal: true })}
                    disabled={isTaskBusy}
                    className="ui-btn-secondary disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Feather className="w-4 h-4" />}
                    生成结局（收尾）
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* 分段结构工作台 */}
          {(shortStoryInfo.segments?.length > 0 || shortStoryInfo.content) && (
            <div className="px-4 py-3 bg-[var(--ui-accent-soft)] border-b border-[rgba(196,92,38,0.2)] space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-[var(--ui-accent-text)]">
                  短篇结构 · 总字数 {shortStoryInfo.content.length} 字
                  {shortStoryInfo.segments?.length ? ` · 已完成 ${shortStoryInfo.segments.filter(s => s.isGenerated).length}/${shortStoryInfo.segments.length} 段` : ''}
                </span>
                <span className="text-xs text-[var(--ui-accent)]">逐段生成 · 可单独重写 · 末段自动收尾</span>
              </div>
              {shortStoryInfo.segments?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {shortStoryInfo.segments.map((seg, idx) => (
                    <div key={seg.segmentNumber} className="ui-card p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--ui-ink)]">
                          {seg.segmentNumber}. {seg.title}
                          <span className={`ml-2 text-xs ${seg.isGenerated ? 'text-[var(--ui-success)]' : 'text-[var(--ui-muted)]'}`}>
                            {seg.isGenerated ? '已写' : '未写'}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--ui-muted)] mt-1 line-clamp-2">{seg.summary}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={isTaskBusy}
                          onClick={() => onGenerateShort({ segmentIndex: idx, rewrite: seg.isGenerated })}
                          className="ui-btn-ghost text-xs disabled:opacity-50"
                        >
                          {seg.isGenerated ? '重写本段' : '生成本段'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
                    <div className="px-4 py-2 border-b border-stone-100 flex items-center gap-2 bg-white shrink-0">
            <div className="ui-seg">
              <button
                type="button"
                onClick={() => setChapterReadMode(true)}
                className={chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
              >
                阅读
              </button>
              <button
                type="button"
                onClick={() => setChapterReadMode(false)}
                className={!chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
              >
                编辑
              </button>
            </div>
            <span className="text-xs text-[var(--ui-muted)]">同一份正文，仅切换展示</span>
          </div>
          
          <div className="px-4 py-2 border-b border-stone-100 bg-white text-xs text-stone-600 flex flex-wrap gap-x-4 gap-y-1 items-center shrink-0">
            <span className="tabular-nums font-medium text-stone-800">字数 {shortWordCount} / {shortTarget}</span>
            <span className="flex-1 min-w-[6rem] h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <span className="block h-full bg-[var(--ui-accent)] rounded-full" style={{ width: `${Math.min(100, Math.round((shortWordCount / shortTarget) * 100))}%` }} />
            </span>
            {shortNearEnd ? (
              <span className="text-amber-700 font-medium">接近目标，建议「生成结局」收束</span>
            ) : (
              <span className="text-stone-500">未到目标可继续写段</span>
            )}
          </div>

              <div className="mx-3 mt-2 mb-1 rounded-xl border border-[var(--ui-line)] bg-white/70 px-3 py-2 text-xs text-[var(--ui-ink)] flex flex-wrap gap-x-4 gap-y-1 items-center shrink-0">
                <span className="tabular-nums font-semibold">
                  本章字数 {activeChapterNum != null ? activeWordCount : 0}
                  <span className="text-[var(--ui-muted)] font-normal"> / 目标约 {minWordCount}</span>
                </span>
                <span className="tabular-nums">全书 {writtenCount}/{targetChapterCount || toc.length || 0} 章</span>
                {isBatchGenerating && generatingChapterNum != null && (
                  <span className="text-[var(--ui-accent-text)] font-medium">批量中 · 正在第 {generatingChapterNum} 章 · 待补 {missingCount}</span>
                )}
                {!isBatchGenerating && missingCount > 0 && (
                  <span className="text-[var(--ui-muted)]">待补缺章 {missingCount}</span>
                )}
              </div>
<div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto bg-white/20">
            {shortStoryInfo.content ? (
              chapterReadMode ? (
                <div className="ui-prose-read py-2">{shortStoryInfo.content}</div>
              ) : (
                <textarea
                  value={shortStoryInfo.content}
                  onChange={(e) => setShortStoryInfo({ ...shortStoryInfo, content: e.target.value })}
                  placeholder="在此编辑正文…"
                  className="ui-input w-full min-h-[calc(100vh-16rem)] max-w-3xl mx-auto block p-5 resize-y leading-7 bg-white"
                />
              )
            ) : (
              <div className="ui-empty min-h-[280px] flex flex-col items-center justify-center">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-10 h-10 mb-3 animate-spin text-[var(--ui-accent)]" />
                    <p className="text-[var(--ui-muted)]">AI 正在写作…</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-10 h-10 mb-3 text-stone-300" />
                    <p className="text-[var(--ui-muted)]">尚无正文</p>
                    <p className="text-xs text-[var(--ui-muted)] mt-1">点击右上角开始生成，或切换到编辑后手动输入</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="ui-chapter-workspace flex h-full min-h-0 overflow-hidden">
        <div className="ui-chapter-rail w-56 md:w-64 shrink-0 flex flex-col">
          <div className="px-3 py-2.5 border-b border-[var(--ui-line)] flex justify-between items-center shrink-0">
            <h3 className="font-medium text-[var(--ui-ink)] text-sm">章节列表</h3>
            <span className="text-[11px] text-[var(--ui-muted)] tabular-nums">{toc.filter(t => chapters[t.chapterNumber]).length}/{toc.length}</span>
          </div>
          <div className="flex-1 py-1.5 space-y-0.5 overflow-y-auto min-h-0 px-1.5">
            {toc.length === 0 ? (
              <div className="ui-empty !py-8 !mx-1 !border-0 bg-transparent">
                <List className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs text-[var(--ui-muted)]">请先生成目录</p>
              </div>
            ) : (
              toc.map(item => (
                <div
                  key={item.chapterNumber}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors border ${
                    activeChapterNum === item.chapterNumber
                      ? 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] font-medium border-[rgba(181,69,85,.26)]'
                      : 'text-stone-600 border-transparent hover:bg-white/65 hover:border-white/70'
                  }`}
                >
                  <button
                    onClick={() => setActiveChapterNum(item.chapterNumber)}
                    className="flex-1 text-left truncate flex items-center gap-2 min-w-0"
                  >
                    {generatingChapterNum === item.chapterNumber && <Loader2 className="w-3 h-3 animate-spin text-[var(--ui-accent)] shrink-0" />}
                    <span className="truncate">第{item.chapterNumber}章 {item.title}</span>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!chapters[item.chapterNumber] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateChapter(item.chapterNumber);
                        }}
                        disabled={isTaskBusy}
                        className="p-1 text-[var(--ui-accent-text)] hover:bg-[var(--ui-accent-soft)] rounded"
                        title="生成内容"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {chapters[item.chapterNumber] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChapter(item.chapterNumber);
                        }}
                        className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
                        title="删除内容"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {chapters[item.chapterNumber] && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 bg-white/32">
          {activeChapterNum ? (
            <>
              <div className="px-4 py-3 border-b border-[var(--ui-line)] flex flex-wrap justify-between items-center gap-2 bg-white/46 backdrop-blur-sm">
                <h3 className="font-semibold text-base text-[var(--ui-ink)] min-w-0 truncate">
                  第{activeChapterNum}章 {toc.find(t => t.chapterNumber === activeChapterNum)?.title}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="ui-seg">
                    <button
                      type="button"
                      onClick={() => setChapterReadMode(true)}
                      className={chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
                      title="阅读模式"
                    >
                      阅读
                    </button>
                    <button
                      type="button"
                      onClick={() => setChapterReadMode(false)}
                      className={!chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
                      title="编辑模式"
                    >
                      编辑
                    </button>
                  </div>
                  <button
                    onClick={isBatchGenerating ? onStopBatch : () => onBatchGenerate()}
                    disabled={isTaskBusy && !isBatchGenerating}
                    className="ui-btn-secondary disabled:opacity-70"
                  >
                    <Play className="w-4 h-4" />
                    {isBatchGenerating ? '停止批量' : '批量下20章'}
                  </button>
                  {onFillMissingChapters && (
                    <button type="button" onClick={() => onFillMissingChapters()} disabled={isTaskBusy || missingCount === 0} className="ui-btn-secondary text-xs disabled:opacity-50" title="只生成有目录但还没有正文的章节">
                      补缺章{missingCount > 0 ? `(${missingCount})` : ''}
                    </button>
                  )}
                  {onPipelineToToc && (
                    <button type="button" onClick={() => onPipelineToToc()} disabled={isTaskBusy} className="ui-btn-secondary text-xs disabled:opacity-50" title="依次推进：大纲→人物→目录（需已选书名）">
                      流水线到目录
                    </button>
                  )}
                  {batchFailedChapters.length > 0 && !isBatchGenerating && (
                    <button
                      type="button"
                      onClick={() => onBatchGenerate({ onlyFailed: true })}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                      title={`失败章节：${batchFailedChapters.join('、')}`}
                    >
                      重试失败({batchFailedChapters.length})
                    </button>
                  )}
                  {chapters[activeChapterNum] && (
                    <button
                      onClick={() => onDeleteChapter(activeChapterNum)}
                      className="ui-btn-ghost text-red-600 hover:bg-red-50"
                    >
                      删除本章
                    </button>
                  )}
                  <button
                    onClick={() => onGenerateChapter(activeChapterNum)}
                    disabled={isTaskBusy}
                    className="ui-btn-primary disabled:opacity-70"
                  >
                    {isGenerating && generatingChapterNum === activeChapterNum ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {chapters[activeChapterNum] ? '重新生成' : '生成本章'}
                  </button>
                  {!!chapters[activeChapterNum] && (
                    <>
                      <button
                        type="button"
                        disabled={isTaskBusy}
                        className="ui-btn-secondary text-xs disabled:opacity-50"
                        onClick={() =>
                          (onChapterAction || onGenerateChapter)(activeChapterNum, {
                            mode: 'continue',
                            stream: true,
                          })
                        }
                      >
                        续写
                      </button>
                      <button
                        type="button"
                        disabled={isTaskBusy}
                        className="ui-btn-secondary text-xs disabled:opacity-50"
                        onClick={() =>
                          (onChapterAction || onGenerateChapter)(activeChapterNum, {
                            mode: 'expand',
                            stream: true,
                          })
                        }
                      >
                        扩写
                      </button>
                      <button
                        type="button"
                        disabled={isTaskBusy}
                        className="ui-btn-secondary text-xs disabled:opacity-50"
                        onClick={() =>
                          (onChapterAction || onGenerateChapter)(activeChapterNum, {
                            mode: 'conclude',
                            stream: true,
                          })
                        }
                      >
                        收束
                      </button>
                    </>
                  )}
                  {onRewriteByQuality && activeChapterNum != null && chapterQualityNotes[activeChapterNum]?.length > 0 && (
                    <button type="button" onClick={() => onRewriteByQuality(activeChapterNum)} disabled={isTaskBusy} className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-amber-300 text-amber-900 bg-amber-50 disabled:opacity-50">
                      按质检重写
                    </button>
                  )}
                </div>
              </div>
              
              {activeChapterNum != null && chapters[activeChapterNum] && (
                <div className="mx-3 mt-2 rounded-xl border border-[var(--ui-line)] bg-white/80 px-3 py-2 text-xs shrink-0">
                  <div className="font-semibold text-[var(--ui-ink)] mb-1">定向改写</div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      className="ui-input flex-1 text-sm !py-1.5"
                      placeholder="本章要改成…（例：高潮延后，多写心理活动）"
                      value={rewriteDirective}
                      onChange={e => setRewriteDirective(e.target.value)}
                      disabled={isTaskBusy}
                    />
                    <button
                      type="button"
                      disabled={isTaskBusy || !rewriteDirective.trim()}
                      className="ui-btn-primary text-xs disabled:opacity-50 shrink-0"
                      onClick={() =>
                        (onChapterAction || onGenerateChapter)(activeChapterNum, {
                          mode: 'rewrite',
                          directive: rewriteDirective.trim(),
                          stream: true,
                        })
                      }
                    >
                      按说明改写
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--ui-muted)] mt-1">比空着重写更稳；可与质检提醒配合使用</p>
                </div>
              )}

              {activeChapterNum != null && chapterQualityNotes[activeChapterNum]?.length > 0 && (
                <div className="mx-3 mt-2 rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shrink-0">
                  <div className="font-semibold mb-1">第{activeChapterNum}章 · 质量提醒</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {chapterQualityNotes[activeChapterNum].map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-1.5 text-[11px] text-amber-800 underline"
                    onClick={() => setChapterQualityNotes(prev => {
                      const next = { ...prev };
                      delete next[activeChapterNum!];
                      return next;
                    })}
                  >
                    知道了，关闭提醒
                  </button>
                </div>
              )}
              {batchFailedChapters.length > 0 && !isBatchGenerating && (
                <div className="mx-3 mt-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-xs text-red-900 shrink-0">
                  <span className="font-semibold">批量失败章节：</span>
                  {batchFailedChapters.slice(0, 12).join('、')}
                  {batchFailedChapters.length > 12 ? '…' : ''}
                  <button
                    type="button"
                    className="ml-2 font-semibold underline"
                    onClick={() => onBatchGenerate({ onlyFailed: true })}
                  >
                    一键重试失败
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto bg-white/20">
                {chapters[activeChapterNum] ? (
                  chapterReadMode && !(isGenerating && generatingChapterNum === activeChapterNum) ? (
                    <div className="ui-prose-read py-4">{chapters[activeChapterNum]}</div>
                  ) : (
                    <div className="max-w-3xl mx-auto w-full">
                      {isGenerating && generatingChapterNum === activeChapterNum && (
                        <p className="text-xs text-[var(--ui-accent-text)] mb-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> 流式生成中…点顶栏「停止」可中断请求
                        </p>
                      )}
                      <textarea
                        value={chapters[activeChapterNum]}
                        onChange={(e) => setChapters(prev => ({ ...prev, [activeChapterNum]: e.target.value }))}
                        className="ui-input w-full h-full min-h-[calc(100vh-14rem)] max-w-3xl mx-auto block p-5 resize-y leading-7 bg-white"
                      />
                    </div>
                  )
                ) : (
                  <div className="ui-empty min-h-[280px] flex flex-col items-center justify-center m-2">
                    {generatingChapterNum === activeChapterNum ? (
                      <>
                        <Loader2 className="w-10 h-10 mb-3 animate-spin text-[var(--ui-accent)]" />
                        <p className="text-[var(--ui-muted)]">正在生成本章…</p>
                        <p className="text-xs text-[var(--ui-muted)] mt-1">顶栏「生成中」为全局状态</p>
                      </>
                    ) : (
                      <>
                        <FileText className="w-10 h-10 mb-3 text-stone-300" />
                        <p className="text-[var(--ui-muted)]">本章尚无正文</p>
                        <p className="text-xs text-[var(--ui-muted)] mt-1">点击右上角「生成本章」或左侧魔法棒</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="ui-empty m-6 min-h-[280px] flex flex-col items-center justify-center">
              <BookOpen className="w-10 h-10 mb-3 text-stone-300" />
              <p className="text-[var(--ui-muted)]">请在左侧选择一个章节</p>
              <p className="text-xs text-[var(--ui-muted)] mt-1">有绿点表示已写正文</p>
            </div>
          )}
        </div>
      </div>
    );
}
