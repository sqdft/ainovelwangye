import {
  BookOpen, Feather, FileText, Globe, LayoutList, List, Loader2, Play, RefreshCw,
  Rows3, Search, Users, Wand2, MoreHorizontal
} from 'lucide-react';

/** 过渡类型：与 App 透传字段兼容，后续按实际用到的 props 收紧 */
export type RealmsPanelProps = Record<string, any>;

export function RealmsPanel(props: RealmsPanelProps) {
  const {
    mode, settings, isTaskBusy, isGenerating, pushToast,
    bookInfo, setBookInfo, characters, setCharacters,
    realmProgress, setRealmProgress, toc, setToc, chapters,
    shortStoryInfo, setShortStoryInfo, shortStoryTitleOptions, setShortStoryTitleOptions,
    tocCompact, setTocCompact, tocMenuOpen, setTocMenuOpen,
    activeChapterNum, setActiveChapterNum, setActiveTab,
    chapterQualityNotes, batchFailedChapters,
    getRealmSystemLabel, themesRecommendRealms,
    handleGenerateBookTitles, handleGenerateBookInfo, handleSelectTitle,
    handleBookPlanningFieldChange, handleLengthChange,
    handleGenerateCharacters, handleAddCharacter, handleDeleteCharacter, handleUpdateCharacter,
    handleGenerateRealms, handleGenerateTOC, handleGenerateSingleChapterOutline,
    handleRegenerateChapterOutline, handleDeleteChapterOutline,
    handleGenerateShortStoryTitles, handleGenerateShortStoryOutline,
    handleGenerateChapter,
  } = props;

if (mode === 'shortStory') return null;
    const protagonist = characters.find(c => c.role === '主角');
    const protagName = protagonist?.name || '主角';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">{getRealmSystemLabel(bookInfo.themes).title}</h2>
          <button
            onClick={handleGenerateRealms}
            disabled={isTaskBusy || !bookInfo.title || !characters || characters.length === 0}
            className="ui-btn-primary disabled:opacity-70"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {getRealmSystemLabel(bookInfo.themes).generateLabel}
          </button>
        </div>

        {realmProgress.realms.length === 0 ? (
          <div className="ui-empty">
            <Globe className="w-12 h-12 text-[rgba(196,92,38,0.45)] mx-auto mb-3" />
            <p className="text-[var(--ui-muted)]">暂无规则体系，请先生成人物后点击右上角生成。</p>
            <p className="text-xs text-[var(--ui-muted)] mt-1">{getRealmSystemLabel(bookInfo.themes).hint}</p>
          </div>
        ) : (
          <>
            {/* 当前境界概览 */}
            <div className="bg-gradient-to-r from-[var(--ui-accent-soft)] to-[#faf6f0] p-4 rounded-xl border border-[rgba(196,92,38,0.2)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-[var(--ui-accent-text)]">主角{protagName}境界体系</span>
                  <div className="text-2xl font-bold text-[var(--ui-accent-text)] mt-1">
                    {realmProgress.realms.length} 阶境界
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-[var(--ui-accent-text)]">自动分配</span>
                  <div className="text-lg font-semibold text-[var(--ui-accent-text)] mt-1">
                    {Object.keys(realmProgress.chapterRealmMap).length} 个突破节点
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-[var(--ui-accent)]">
                境界按章节进度自动推进，生成章节时AI自动识别当前境界并融入剧情
              </div>
            </div>

            {/* 境界列表 */}
            <div className="space-y-3">
              {realmProgress.realms.map((realm, idx) => {
                const isStarting = idx === 0;
                // 找到该大境界对应的所有突破章节
                const realmBreakpoints = Object.entries(realmProgress.chapterRealmMap)
                  .filter(([, val]) => (val as any).realmIndex === idx)
                  .map(([ch, val]) => ({ ch: Number(ch), subIdx: (val as any).subRealmIndex }))
                  .sort((a, b) => a.ch - b.ch);
                const bigBreakthrough = realmBreakpoints.find(bp => bp.subIdx === 0);
                return (
                  <div key={realm.id} className={`p-4 rounded-xl border transition-all ${
                    isStarting ? 'bg-green-50 border-green-200' :
                    bigBreakthrough ? 'bg-amber-50 border-amber-200' :
                    'bg-white border-stone-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          isStarting ? 'bg-green-600 text-white' :
                          bigBreakthrough ? 'bg-amber-500 text-white' :
                          'bg-stone-100 text-[var(--ui-muted)]'
                        }`}>
                          {realm.level}
                        </span>
                        <div>
                          <span className={`font-semibold ${isStarting ? 'text-green-900' : bigBreakthrough ? 'text-amber-900' : 'text-stone-700'}`}>
                            {realm.name}
                          </span>
                          {isStarting && <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">起始</span>}
                          {bigBreakthrough && <span className="ml-2 text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full">第{bigBreakthrough.ch}章突破</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 ml-11 text-sm text-stone-600">{realm.description}</div>
                    {/* 小境界列表 */}
                    {realm.subRealms && realm.subRealms.length > 0 && (
                      <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                        {realm.subRealms.map((sub, si) => {
                          const subBp = realmBreakpoints.find(bp => bp.subIdx === si);
                          const isStartSub = isStarting && si === 0;
                          return (
                            <span key={si} className={`text-xs px-2 py-1 rounded-full border ${
                              isStartSub ? 'bg-green-100 text-green-700 border-green-300' :
                              subBp ? 'bg-amber-100 text-amber-700 border-amber-300' :
                              'bg-stone-50 text-[var(--ui-muted)] border-stone-200'
                            }`}>
                              {sub.name}{subBp ? `·第${subBp.ch}章` : isStartSub ? '·起始' : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {realm.breakthroughCondition && idx < realmProgress.realms.length - 1 && (
                      <div className="mt-1 ml-11 text-xs text-amber-600">
                        大境界突破条件：{realm.breakthroughCondition}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 章节境界映射 */}
            {Object.keys(realmProgress.chapterRealmMap).length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-stone-100">
                <h3 className="font-semibold text-stone-800 mb-3">章节突破记录</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(realmProgress.chapterRealmMap)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([ch, val]) => {
                      const bp = val as any;
                      const realm = realmProgress.realms[bp.realmIndex ?? bp];
                      const subRealm = realm?.subRealms?.[bp.subRealmIndex ?? 0];
                      const fullName = subRealm ? `${realm?.name}·${subRealm.name}` : realm?.name || '未知';
                      const isBig = bp.subRealmIndex === 0 && bp.realmIndex > 0;
                      return (
                        <span key={ch} className={`text-xs px-2 py-1 rounded-full border ${
                          isBig ? 'bg-amber-100 text-amber-800 border-amber-300 font-medium' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          第{ch}章 → {fullName}{isBig ? ' ★大境界' : ''}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  
}
