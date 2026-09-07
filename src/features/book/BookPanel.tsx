import {
  BookOpen, Feather, FileText, Globe, LayoutList, List, Loader2, Play, RefreshCw,
  Rows3, Search, Users, Wand2, MoreHorizontal
} from 'lucide-react';
import { ThemeSelector } from '../../components/ThemeSelector';
import { LENGTHS } from '../../config/lengths';
import type { ShortStoryInfo } from '../../types';

export type BookPanelProps = {
  // 宽兼容：App 仍透传多字段；逐步收紧时优先用到的字段
  mode: 'novel' | 'shortStory';
  settings: any;
  isTaskBusy: boolean;
  isGenerating: boolean;
  pushToast?: (...args: any[]) => void;
  bookInfo: any;
  setBookInfo: (v: any) => void;
  shortStoryInfo?: any;
  setShortStoryInfo?: (v: any) => void;
  shortStoryTitleOptions?: string[];
  setShortStoryTitleOptions?: (v: any) => void;
  getRealmSystemLabel?: (themes: string[]) => { title: string; hint?: string; generateLabel?: string };
  themesRecommendRealms?: (themes: string[]) => string;
  handleGenerateBookTitles?: () => void;
  handleGenerateBookInfo?: () => void;
  handleSelectTitle?: (title: string) => void;
  handleBookThemesChange?: (themes: string[]) => void;
  handleBookTitleInput?: (title: string) => void;
  handleBookPlanningFieldChange?: (field: 'outline' | 'worldbuilding', value: string) => void;
  handleLengthChange?: (lengthType: string) => void;
  handleGenerateShortStoryTitles?: () => void;
  handleGenerateShortStoryOutline?: () => void;
  [key: string]: any; // 过渡：其它透传字段
};

export function BookPanel(props: BookPanelProps) {
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
    handleBookThemesChange,
    handleBookTitleInput,
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
  const handleSelectBookTitle = handleSelectTitle;

  const updateShortStorySetup = (patch: Partial<ShortStoryInfo>) => {
    const hasDownstream = !!shortStoryInfo.content.trim() || shortStoryInfo.segments.length > 0 || shortStoryInfo.isOutlineGenerated;
    const changed = Object.entries(patch).some(([key, value]) => shortStoryInfo[key as keyof ShortStoryInfo] !== value);
    if (!changed) return;

    if (hasDownstream && !window.confirm('修改标题、主题、目标字数或故事大纲会使现有分段正文失效。确定清空正文并重新规划吗？')) {
      return;
    }

    setShortStoryInfo({
      ...shortStoryInfo,
      ...patch,
      ...(hasDownstream ? {
        content: '',
        currentSegment: 0,
        segments: shortStoryInfo.segments.map(segment => ({ ...segment, content: '', isGenerated: false })),
        isOutlineGenerated: false,
      } : {}),
    });
  };

if (mode === 'shortStory') {
      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">短篇故事设定</h2>
          </div>

          <div className="ui-card p-6 md:p-8 space-y-6">
            <ThemeSelector onMaxReached={(msg) => pushToast?.(msg, 'warn')}
              type="shortStory"
              selectedThemes={shortStoryInfo.themes}
              onChange={(themes) => updateShortStorySetup({ themes })}
            />

            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] gap-5 items-start">
              <div className="space-y-2 min-w-0">
                <label className="block text-sm font-medium text-stone-700 leading-5 h-5">故事标题</label>
                <div className="flex gap-2 items-center min-h-11">
                  <input
                    type="text"
                    value={shortStoryInfo.title}
                    onChange={(e) => updateShortStorySetup({ title: e.target.value })}
                    placeholder="请输入标题，或点右侧 AI 构思"
                    className="flex-1 min-w-0 ui-input h-11"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateShortStoryTitles}
                    disabled={isTaskBusy || !shortStoryInfo.themes || shortStoryInfo.themes.length === 0}
                    className="ui-btn-ghost text-xs shrink-0 h-11 px-3 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isGenerating && (!shortStoryTitleOptions || shortStoryTitleOptions.length === 0) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI 构思标题
                  </button>
                </div>
                {shortStoryTitleOptions && shortStoryTitleOptions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {shortStoryTitleOptions.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => updateShortStorySetup({ title: t })}
                        className="px-2.5 py-1.5 text-xs bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] rounded-lg border border-[var(--ui-line)] hover:brightness-95 transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 min-w-0">
                <label className="block text-sm font-medium text-stone-700 leading-5 h-5">目标总字数</label>
                <div className="flex gap-2 items-center min-h-11">
                  <input
                    type="number"
                    value={shortStoryInfo.targetWordCount}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      updateShortStorySetup({
                        targetWordCount: Number.isFinite(n) ? Math.min(30000, Math.max(1000, n)) : 10000
                      });
                    }}
                    min={1000}
                    max={30000}
                    step={500}
                    className="w-full ui-input h-11"
                  />
                </div>
                <p className="text-xs text-[var(--ui-muted)]">建议 7000–12000 字（约中篇短故事）；当前 {shortStoryInfo.targetWordCount || 0} 字</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <label className="block text-sm font-medium text-stone-700">核心脑洞 / 故事大纲</label>
                <button
                  type="button"
                  onClick={handleGenerateShortStoryOutline}
                  disabled={isTaskBusy || !shortStoryInfo.title}
                  className="ui-btn-ghost text-xs disabled:opacity-50 h-9 px-3"
                >
                  {isGenerating && shortStoryInfo.title && !shortStoryInfo.outline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI 生成大纲
                </button>
              </div>
              <textarea
                value={shortStoryInfo.outline}
                onChange={(e) => updateShortStorySetup({ outline: e.target.value })}
                placeholder="描述这个短篇故事的核心创意、主要情节和结局。也可以先点右上角「AI 生成大纲」。"
                rows={8}
                className="w-full ui-input ui-textarea min-h-[11rem] resize-y"
              />
            </div>
            <div className="ui-seed-tip text-sm text-[var(--ui-muted)]">
              先选主题 → 定标题与目标字数 → 写清大纲 → 再到「故事正文」按段生成。
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] uppercase text-[var(--ui-accent-text)]">第一步 · 故事种子</p>
            <h2 className="text-2xl font-semibold text-[var(--ui-ink)] mt-1">书籍设定</h2>
            <p className="text-sm text-[var(--ui-muted)] mt-1">从题材、篇幅与书名开始，为故事建立第一块骨架。</p>
          </div>
          <button
            onClick={handleGenerateBookInfo}
            disabled={isTaskBusy || !bookInfo.isTitleSelected}
            className="ui-btn-primary disabled:opacity-70"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 生成大纲设定
          </button>
        </div>

        <div className="ui-card p-6 md:p-8 space-y-6">
          <ThemeSelector
            selectedThemes={bookInfo.themes}
            onChange={handleBookThemesChange}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2 min-w-0">
              <label className="block text-sm font-medium text-stone-700 leading-5 h-5">小说篇幅</label>
              <div className="flex gap-2 items-center min-h-11">
                <select
                  value={bookInfo.lengthType}
                  onChange={(e) => handleLengthChange(e.target.value)}
                  className="flex-1 min-w-0 ui-input h-11"
                >
                  {LENGTHS.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                {bookInfo.lengthType === 'custom' && (
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={bookInfo.targetChapterCount}
                      onChange={(e) => setBookInfo({ ...bookInfo, targetChapterCount: parseInt(e.target.value) || 1 })}
                      className="w-full ui-input h-11"
                      placeholder="章数"
                    />
                    <span className="text-sm text-[var(--ui-muted)] shrink-0">章</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <label className="block text-sm font-medium text-stone-700 leading-5 h-5">书名</label>
              <div className="flex gap-2 items-center min-h-11">
                <input
                  type="text"
                  value={bookInfo.title}
                  onChange={(e) => handleBookTitleInput(e.target.value)}
                  placeholder="请先生成书名或手动输入"
                  className="flex-1 min-w-0 ui-input h-11"
                />
                <button
                  type="button"
                  onClick={handleGenerateBookTitles}
                  disabled={isTaskBusy || !bookInfo.themes || bookInfo.themes.length === 0}
                  className="ui-btn-ghost text-xs shrink-0 h-11 px-3 disabled:opacity-50 whitespace-nowrap"
                >
                  {isGenerating && (!bookInfo.titleOptions || bookInfo.titleOptions.length === 0) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI 构思书名
                </button>
              </div>
            </div>
          </div>

          {/* 书名卡片选择区域 - 选择后自动消失 */}
          {bookInfo.titleOptions && bookInfo.titleOptions.length > 0 && (
            <div className="border-t border-[var(--ui-line)] pt-6 -mx-8 px-8">
              <p className="text-sm text-[var(--ui-muted)] mb-4 font-medium">从这些名字里，选择最像你故事的那一个：</p>
              <div className="grid grid-cols-1 gap-3">
                {bookInfo.titleOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectBookTitle(option.title)}
                    className="ui-title-choice text-left p-5 group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-[var(--ui-accent)] text-white rounded-lg flex items-center justify-center font-bold text-base group-hover:scale-110 transition-transform">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[var(--ui-ink)] text-base mb-1.5 group-hover:text-[var(--ui-accent-text)] transition-colors">
                          《{option.title}》
                        </h3>
                        <p className="text-sm text-stone-600 leading-relaxed">
                          {option.intro}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-[var(--ui-accent)] group-hover:text-[var(--ui-accent-text)] transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 已选择书名提示 */}
          {bookInfo.isTitleSelected && bookInfo.title && (
            <div className="border-t border-stone-100 pt-6">
              <p className="text-sm text-[var(--ui-success)] flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-[var(--ui-success)] rounded-full"></span>
                已选择书名：《{bookInfo.title}》
              </p>

              {/* 境界 / 世界规则开关 */}
              <div className="ui-realm-note flex items-center justify-between p-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-[var(--ui-ink)] flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bookInfo.enableRealms ?? (themesRecommendRealms(bookInfo.themes) === 'recommend')}
                      onChange={(e) => {
                        const enableRealms = e.target.checked;
                        setBookInfo({...bookInfo, enableRealms});
                        if (!enableRealms) {
                          setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
                        }
                      }}
                      className="w-4 h-4 text-[var(--ui-accent-text)] border-amber-300 rounded focus:ring-[rgba(196,92,38,0.15)]"
                    />
                    启用{getRealmSystemLabel(bookInfo.themes).title}
                  </label>
                  <p className="text-xs text-[var(--ui-muted)] mt-1 ml-6">
                    {getRealmSystemLabel(bookInfo.themes).hint}
                    {themesRecommendRealms(bookInfo.themes) === 'recommend' && '（当前题材：建议开启）'}
                    {themesRecommendRealms(bookInfo.themes) === 'hide' && '（当前题材：默认不推荐，可选）'}
                    {themesRecommendRealms(bookInfo.themes) === 'optional' && '（当前题材：按需开启）'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 大纲和世界观 - 始终显示 */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">故事大纲</label>
              <textarea
                value={bookInfo.outline}
                onChange={(e) => handleBookPlanningFieldChange('outline', e.target.value)}
                placeholder={bookInfo.isTitleSelected ? "点击右上角按钮生成，或手动填写..." : "请先选择书名后再填写大纲"}
                disabled={!bookInfo.isTitleSelected}
                className="w-full ui-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">世界观设定</label>
              <textarea
                value={bookInfo.worldbuilding}
                onChange={(e) => handleBookPlanningFieldChange('worldbuilding', e.target.value)}
                placeholder={bookInfo.isTitleSelected ? "点击右上角按钮生成，或手动填写..." : "请先选择书名后再填写世界观"}
                disabled={!bookInfo.isTitleSelected}
                className="w-full ui-input"
              />
            </div>
          </div>

          {/* 引导提示 */}
          {!bookInfo.isTitleSelected && (
            <div className="ui-seed-tip p-4">
              <p className="text-sm text-[var(--ui-muted)]">
                先选择主题和篇幅，再点击“AI 构思书名”。确定书名后，就可以继续生成大纲与世界观。
              </p>
            </div>
          )}
        </div>
      </div>
    );

}
