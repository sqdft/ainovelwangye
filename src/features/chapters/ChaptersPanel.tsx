import { useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
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
  const [shortCopied, setShortCopied] = useState(false);

  const copyShortStoryContent = async () => {
    const content = shortStoryInfo.content || '';
    if (!content.trim()) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const helper = document.createElement('textarea');
        helper.value = content;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand('copy');
        helper.remove();
        if (!copied) throw new Error('copy command failed');
      }
      setShortCopied(true);
      window.setTimeout(() => setShortCopied(false), 1800);
    } catch (error) {
      console.warn('\u590d\u5236\u77ed\u6545\u4e8b\u6b63\u6587\u5931\u8d25:', error);
      setShortCopied(false);
    }
  };

  const shortWordCount = (shortStoryInfo.content || '').replace(/\s/g, '').length;
  const shortTarget = Math.max(shortStoryInfo.targetWordCount || 10000, 1);
  const shortNearEnd = shortWordCount >= shortTarget * 0.9;
  const activeContent = activeChapterNum != null ? (chapters[activeChapterNum] || '') : '';
  const activeWordCount = activeContent.replace(/\s/g, '').length;
  const writtenCount = Object.keys(chapters).length;
  const missingCount = toc.filter(t => !chapters[t.chapterNumber]).length;

  const renderProse = (content: string) =>
    content.split(/\n{2,}/).filter(paragraph => paragraph.trim()).map((paragraph, index) => (
      <p key={index}>{paragraph}</p>
    ));



  if (mode === 'shortStory') {
    const generatedSegments = shortStoryInfo.segments?.filter(s => s.isGenerated).length || 0;
    const totalSegments = shortStoryInfo.segments?.length || 0;
    const progressPercent = Math.min(100, Math.round((shortWordCount / shortTarget) * 100));

    return (
      <section className="ui-short-story-workspace" aria-label="短故事正文工作台">
        <header className="ui-short-story-header">
          <div className="min-w-0">
            <p className="ui-short-story-kicker">短篇正文</p>
            <h3 className="ui-short-story-title">{shortStoryInfo.title || '未命名短篇'}</h3>
            <p className="ui-short-story-subtitle">
              {totalSegments > 0
                ? `共 ${totalSegments} 段 · 已完成 ${generatedSegments} 段`
                : '可以直接阅读、编辑或继续生成正文'}
            </p>
          </div>
          <div className="ui-short-story-actions">
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
                <div className="ui-menu right-0 top-full mt-1 w-52">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('确定要清空当前正文和所有分段内容吗？')) {
                        setShortStoryInfo({
                          ...shortStoryInfo,
                          content: '',
                          currentSegment: 0,
                          segments: (shortStoryInfo.segments || []).map(s => ({ ...s, content: '', isGenerated: false })),
                        });
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
                      if (confirm('确定要重置所有故事信息吗？这将清空标题、分段和正文，但不会影响 API 配置。')) {
                        setShortStoryInfo({
                          title: '',
                          themes: [SHORT_STORY_THEME_NAMES[0]],
                          targetWordCount: 10000,
                          outline: '',
                          content: '',
                          segments: [],
                          currentSegment: 0,
                          isOutlineGenerated: false,
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
            <button
              type="button"
              onClick={() => onGenerateShort({})}
              disabled={isTaskBusy || (!shortStoryInfo.outline && !totalSegments)}
              className="ui-btn-primary disabled:opacity-70"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {totalSegments
                ? (generatedSegments >= totalSegments
                  ? '已全部生成'
                  : `生成：${shortStoryInfo.segments?.find(s => !s.isGenerated)?.title || '下一段'}`)
                : (shortStoryInfo.content ? '继续生成' : '生成正文')}
            </button>
            {!!shortStoryInfo.content && (
              <button
                type="button"
                onClick={() => onGenerateShort({ forceFinal: true })}
                disabled={isTaskBusy}
                className="ui-btn-secondary disabled:opacity-70"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Feather className="w-4 h-4" />}
                生成最终稿
              </button>
            )}
            <button
              type="button"
              onClick={() => void copyShortStoryContent()}
              disabled={!shortStoryInfo.content?.trim()}
              className="ui-btn-secondary ui-short-story-copy disabled:opacity-50"
              title="复制完整短故事正文"
            >
              {shortCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {shortCopied ? '已复制' : '复制全文'}
            </button>
          </div>
        </header>

        <div className="ui-short-story-overview">
          <div className="ui-short-story-overview-line">
            <span className="ui-short-story-overview-label">正文进度</span>
            <span className="tabular-nums font-semibold">{shortWordCount.toLocaleString()} / {shortTarget.toLocaleString()} 字</span>
            <span className="ui-short-story-overview-note">
              {shortNearEnd ? '已接近目标字数' : '继续生成，逐步完善故事'}
            </span>
          </div>
          <div className="ui-short-story-progress-track" aria-label={`正文进度 ${progressPercent}%`}>
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {totalSegments > 0 && (
          <section className="ui-short-story-segments" aria-label="分段结构">
            <div className="ui-short-story-section-heading">
              <div>
                <h4>分段结构</h4>
                <p>逐段生成，也可以单独重写某一段</p>
              </div>
              <span>{generatedSegments}/{totalSegments} 段已完成</span>
            </div>
            <div className="ui-short-story-segment-grid">
              {shortStoryInfo.segments?.map((seg, idx) => (
                <article key={seg.segmentNumber} className="ui-short-story-segment-card">
                  <div className="ui-short-story-segment-topline">
                    <span className="ui-short-story-segment-number">{seg.segmentNumber}</span>
                    <span className={`ui-short-story-segment-status ${seg.isGenerated ? 'is-done' : ''}`}>
                      {seg.isGenerated ? '已写' : '未写'}
                    </span>
                  </div>
                  <h5>{seg.title}</h5>
                  <p>{seg.summary || '暂无分段说明'}</p>
                  <button
                    type="button"
                    disabled={isTaskBusy}
                    onClick={() => onGenerateShort({ segmentIndex: idx, rewrite: seg.isGenerated })}
                    className="ui-short-story-segment-action disabled:opacity-50"
                  >
                    {seg.isGenerated ? '重写本段' : '生成本段'}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="ui-short-story-main">
          <div className="ui-short-story-modebar">
            <div className="ui-seg" role="tablist" aria-label="正文模式">
              <button
                type="button"
                role="tab"
                aria-selected={chapterReadMode}
                onClick={() => setChapterReadMode(true)}
                className={chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
              >
                <BookOpen className="w-3.5 h-3.5" /> 阅读
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!chapterReadMode}
                onClick={() => setChapterReadMode(false)}
                className={!chapterReadMode ? 'ui-seg-active' : 'ui-seg-idle'}
              >
                <FileText className="w-3.5 h-3.5" /> 编辑
              </button>
            </div>
            <span className="ui-short-story-modehint">
              {chapterReadMode ? '沉浸式阅读：宽版稿纸，减少无意义滚动' : '编辑模式：整块写作区，输入内容会自动保存'}
            </span>
            <div className="ui-short-story-inline-stats">
              <span>正文 {shortWordCount.toLocaleString()} 字</span>
              {isGenerating && <span className="ui-short-story-generating"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在生成</span>}
            </div>
          </div>

          <div className={`ui-short-story-content ${chapterReadMode ? 'is-reading' : 'is-editing'}`}>
            {shortStoryInfo.content ? (
              chapterReadMode ? (
                <article className="ui-short-story-paper ui-prose-read">
                  {renderProse(shortStoryInfo.content)}
                </article>
              ) : (
                <div className="ui-short-story-editor-wrap">
                  <textarea
                    value={shortStoryInfo.content}
                    onChange={(e) => setShortStoryInfo({ ...shortStoryInfo, content: e.target.value })}
                    placeholder="可以直接编辑正文，内容会自动保存"
                    className="ui-input ui-short-story-editor"
                  />
                </div>
              )
            ) : (
              <div className="ui-empty ui-short-story-empty">
                {isGenerating ? (
                  <>
                    <Loader2 className="w-10 h-10 mb-3 animate-spin text-[var(--ui-accent)]" />
                    <p className="text-[var(--ui-muted)]">AI 正在生成正文...</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-10 h-10 mb-3 text-stone-300" />
                    <p className="text-[var(--ui-muted)]">尚无正文</p>
                    <p className="text-xs text-[var(--ui-muted)] mt-1">点击上方开始生成，或切换到编辑后手动输入</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
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
                    <article className="ui-prose-read py-4">{renderProse(chapters[activeChapterNum])}</article>
                  ) : (
                    <div className="ui-chapter-editor-shell">
                      {isGenerating && generatingChapterNum === activeChapterNum && (
                        <p className="text-xs text-[var(--ui-accent-text)] mb-2 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> 流式生成中…点顶栏「停止」可中断请求
                        </p>
                      )}
                      <textarea
                        value={chapters[activeChapterNum]}
                        onChange={(e) => setChapters(prev => ({ ...prev, [activeChapterNum]: e.target.value }))}
                        className="ui-input ui-chapter-editor"
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
