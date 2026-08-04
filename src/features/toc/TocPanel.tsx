import {
  BookOpen, Feather, FileText, Globe, LayoutList, List, Loader2, Play, RefreshCw,
  Rows3, Search, Users, Wand2, MoreHorizontal
} from 'lucide-react';

/** 过渡类型：与 App 透传字段兼容，后续按实际用到的 props 收紧 */
export type TocPanelProps = Record<string, any>;

export function TocPanel(props: TocPanelProps) {
  const {
    mode,
    settings,
    isTaskBusy,
    isGenerating,
    pushToast,
    bookInfo,
    setBookInfo,
    characters,
    setCharacters,
    realmProgress,
    setRealmProgress,
    toc,
    setToc,
    chapters,
    shortStoryInfo,
    setShortStoryInfo,
    shortStoryTitleOptions,
    setShortStoryTitleOptions,
    tocCompact,
    setTocCompact,
    tocMenuOpen,
    setTocMenuOpen,
    activeChapterNum,
    setActiveChapterNum,
    setActiveTab,
    chapterQualityNotes,
    batchFailedChapters,
    getRealmSystemLabel,
    themesRecommendRealms,
    handleGenerateBookTitles,
    handleGenerateBookInfo,
    handleSelectTitle,
    handleBookPlanningFieldChange,
    handleLengthChange,
    handleGenerateCharacters,
    handleAddCharacter,
    handleDeleteCharacter,
    handleUpdateCharacter,
    handleGenerateRealms,
    handleGenerateTOC,
    handleGenerateSingleChapterOutline,
    handleRegenerateChapterOutline,
    handleDeleteChapterOutline,
    handleGenerateShortStoryTitles,
    handleGenerateShortStoryOutline,
    handleGenerateChapter,
  } = props;
  const handleDeleteTOCItem = handleDeleteChapterOutline;
  
if (mode === 'shortStory') return null;

    const nextStart = toc.length + 1;
    const nextEnd = Math.min(nextStart + 29, bookInfo.targetChapterCount);
    const isComplete = toc.length >= bookInfo.targetChapterCount;
    const progressPct = bookInfo.targetChapterCount
      ? Math.min(100, Math.round((toc.length / bookInfo.targetChapterCount) * 100))
      : 0;

    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--ui-ink)] tracking-tight">目录大纲</h2>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 max-w-xs h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--ui-accent)]/80 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-sm font-medium text-stone-600 tabular-nums shrink-0">
                {toc.length} / {bookInfo.targetChapterCount} 章
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="ui-seg">
              <button
                type="button"
                onClick={() => setTocCompact(true)}
                className={tocCompact ? 'ui-seg-active' : 'ui-seg-idle'}
                title="紧凑列表"
              >
                <Rows3 className="w-3.5 h-3.5" />
                紧凑
              </button>
              <button
                type="button"
                onClick={() => setTocCompact(false)}
                className={!tocCompact ? 'ui-seg-active' : 'ui-seg-idle'}
                title="卡片精修"
              >
                <LayoutList className="w-3.5 h-3.5" />
                精修
              </button>
            </div>
            <button
              onClick={handleGenerateSingleChapterOutline}
              disabled={isTaskBusy || !characters || characters.length === 0 || isComplete}
              className="ui-btn-secondary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              生成单章
            </button>
            <button
              onClick={handleGenerateTOC}
              disabled={isTaskBusy || !characters || characters.length === 0 || isComplete}
              className="ui-btn-primary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isComplete ? '目录已全部生成' : `批量 (${nextStart}-${nextEnd})`}
            </button>
          </div>
        </div>

        {(!toc || toc.length === 0) ? (
          <div className="ui-empty">
            <List className="w-11 h-11 text-[rgba(196,92,38,0.45)] mx-auto mb-3" />
            <p className="text-stone-600 font-medium">还没有目录大纲</p>
            <p className="text-sm text-[var(--ui-muted)] mt-1">请先生成人物，再点击批量生成</p>
          </div>
        ) : tocCompact ? (
          <div className="ui-card overflow-hidden divide-y divide-[rgba(181,69,85,.10)]">
            {toc.map((item, idx) => (
              <div
                key={item.chapterNumber}
                className="toc-row flex items-center gap-3 px-3 py-2.5 group"
              >
                <span className="toc-number w-9 shrink-0 text-center text-xs font-semibold tabular-nums">
                  {item.chapterNumber}
                </span>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].title = e.target.value;
                      setToc(newToc);
                    }}
                    className="w-full font-medium text-sm text-[var(--ui-ink)] bg-transparent border-none focus:ring-0 p-0 truncate"
                    placeholder="章节标题"
                  />
                  <p className="text-xs text-[var(--ui-muted)] truncate mt-0.5">{item.summary || '暂无摘要'}</p>
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  {chapters[item.chapterNumber] ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="已有正文" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-300" title="未写" />
                  )}
                  {chapterQualityNotes[item.chapterNumber]?.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="有质量提醒" />
                  )}
                  {batchFailedChapters.includes(item.chapterNumber) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="批量失败" />
                  )}
                </span>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setTocMenuOpen(tocMenuOpen === item.chapterNumber ? null : item.chapterNumber)}
                    className="p-1.5 rounded-lg text-[var(--ui-muted)] hover:bg-stone-100 hover:text-stone-700"
                    title="更多"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {tocMenuOpen === item.chapterNumber && (
                    <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-30 py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveChapterNum(item.chapterNumber);
                          setActiveTab('chapters');
                          setTocMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-sm text-left text-stone-700 hover:bg-stone-50"
                      >
                        前往正文
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleRegenerateChapterOutline(item.chapterNumber);
                          setTocMenuOpen(null);
                        }}
                        disabled={isTaskBusy}
                        className="w-full px-3 py-2 text-sm text-left text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        重新生成
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteTOCItem(item.chapterNumber);
                          setTocMenuOpen(null);
                        }}
                        className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {toc.map((item, idx) => (
              <div key={item.chapterNumber} className="ui-card ui-toc-paper p-5 flex gap-4">
                <div className="toc-number flex-shrink-0 w-12 h-12 flex items-center justify-center font-serif text-xl">
                  {item.chapterNumber}
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].title = e.target.value;
                      setToc(newToc);
                    }}
                    className="w-full font-semibold text-[var(--ui-ink)] bg-transparent border-none focus:ring-0 p-0"
                    placeholder="章节标题"
                  />
                  <textarea
                    value={item.summary}
                    onChange={(e) => {
                      const newToc = [...toc];
                      newToc[idx].summary = e.target.value;
                      setToc(newToc);
                    }}
                    className="ui-input h-20 resize-none"
                    placeholder="章节内容摘要"
                  />
                </div>
                <div className="flex-shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setActiveChapterNum(item.chapterNumber);
                      setActiveTab('chapters');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--ui-accent-text)] bg-[var(--ui-accent-soft)] rounded-lg hover:bg-[var(--ui-accent-soft)]"
                  >
                    前往正文
                  </button>
                  <button
                    onClick={() => handleRegenerateChapterOutline(item.chapterNumber)}
                    disabled={isTaskBusy}
                    className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-70"
                  >
                    {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : '重新生成'}
                  </button>
                  <button
                    onClick={() => handleDeleteTOCItem(item.chapterNumber)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  
}
