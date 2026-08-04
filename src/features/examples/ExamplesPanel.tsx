import {
  BookOpen, Feather, FileText, Globe, LayoutList, List, Loader2, Play, RefreshCw,
  Rows3, Search, Users, Wand2, MoreHorizontal
} from 'lucide-react';
import { EXAMPLE_LINKS } from '../../config/examples';

/** 过渡类型：与 App 透传字段兼容，后续按实际用到的 props 收紧 */
export type ExamplesPanelProps = Record<string, any>;

export function ExamplesPanel(props: ExamplesPanelProps) {
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

  return (
<div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">小说范文参考</h2>
        <p className="text-sm text-[var(--ui-muted)]">点击下方链接阅读优秀小说示例</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXAMPLE_LINKS.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-5 rounded-2xl shadow-sm border border-stone-100 hover:border-amber-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[var(--ui-ink)] group-hover:text-amber-700 transition-colors">{link.title}</h3>
                <p className="text-xs text-[var(--ui-muted)] truncate">{link.url}</p>
              </div>
              <Globe className="w-4 h-4 text-[var(--ui-muted)] group-hover:text-amber-500 transition-colors" />
            </div>
          </a>
        ))}
      </div>

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-6">
        <p className="text-sm text-amber-800">
          💡 提示：阅读优秀范文可以帮助你更好地理解小说结构、人物塑造和情节设计。建议在创作前先浏览这些示例获取灵感。
        </p>
      </div>
    </div>
  
  );
}
