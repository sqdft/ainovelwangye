import {
  BookOpen, Feather, FileText, Globe, LayoutList, List, Loader2, Play, RefreshCw,
  Rows3, Search, Users, Wand2, MoreHorizontal
} from 'lucide-react';

/** 过渡类型：与 App 透传字段兼容，后续按实际用到的 props 收紧 */
export type CharactersPanelProps = Record<string, any>;

export function CharactersPanel(props: CharactersPanelProps) {
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
        <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">人物关系</h2>
        <div className="flex gap-2">
          <button
            onClick={handleAddCharacter}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
          >
            <Users className="w-4 h-4" />
            添加人物
          </button>
          <button
            onClick={handleGenerateCharacters}
            disabled={isTaskBusy || !bookInfo.title}
            className="ui-btn-primary disabled:opacity-70"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI 生成人物
          </button>
        </div>
      </div>

      {(!characters || characters.length === 0) ? (
        <div className="ui-empty">
          <Users className="w-12 h-12 text-[rgba(196,92,38,0.45)] mx-auto mb-3" />
          <p className="text-[var(--ui-muted)]">暂无人物设定，请点击右上角生成或手动添加。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((char, idx) => (
            <div key={char.id || idx} className="ui-card p-5">
              <div className="flex items-center justify-between mb-3">
                <input 
                  type="text" 
                  value={char.name}
                  onChange={(e) => handleUpdateCharacter(char.id, 'name', e.target.value)}
                  placeholder="角色姓名"
                  className="font-semibold text-lg text-[var(--ui-ink)] bg-transparent border-none focus:ring-0 p-0 w-32"
                />
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={char.role}
                    onChange={(e) => handleUpdateCharacter(char.id, 'role', e.target.value)}
                    placeholder="角色定位"
                    className="text-xs font-medium px-2 py-1 bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] rounded-full border-none focus:ring-0 text-right w-24"
                  />
                  <button
                    onClick={() => handleDeleteCharacter(char.id)}
                    className="p-1 text-[var(--ui-muted)] hover:text-red-500 transition-colors"
                    title="删除人物"
                  >
                    ×
                  </button>
                </div>
              </div>
              <textarea 
                value={char.description}
                onChange={(e) => handleUpdateCharacter(char.id, 'description', e.target.value)}
                placeholder="角色描述（性格、背景、关系等）"
                className="w-full text-sm text-stone-600 bg-stone-50 border border-stone-100 rounded-lg p-3 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-[rgba(196,92,38,0.15)]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  
  );
}
