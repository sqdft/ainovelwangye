import { useState } from 'react';
import { Search } from 'lucide-react';
import { MALE_THEME_NAMES, FEMALE_THEME_NAMES, SHORT_STORY_THEME_NAMES } from '../config/themes';

export function ThemeSelector({ 
  selectedThemes, 
  onChange,
  type = 'novel',
  onMaxReached,
}: { 
  selectedThemes: string[], 
  onChange: (themes: string[]) => void,
  type?: 'novel' | 'shortStory',
  onMaxReached?: (msg: string) => void,
}) {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [showAll, setShowAll] = useState(false);
  const [themeQuery, setThemeQuery] = useState('');
  
  // 防御性检查：确保 selectedThemes 是数组
  const safeSelectedThemes = Array.isArray(selectedThemes) ? selectedThemes : [];
  const availableThemes = type === 'shortStory' ? SHORT_STORY_THEME_NAMES : (gender === 'male' ? MALE_THEME_NAMES : FEMALE_THEME_NAMES);
  // 防御性检查：确保 availableThemes 是数组
  const safeAvailableThemes = Array.isArray(availableThemes) ? availableThemes : [];
  const q = themeQuery.trim().toLowerCase();
  const filteredThemes = q
    ? safeAvailableThemes.filter((t) => t.toLowerCase().includes(q))
    : safeAvailableThemes;
  const displayThemes = q || showAll ? filteredThemes : filteredThemes.slice(0, 15);

  // 当切换男女频时，清空已选主题
  const handleGenderChange = (newGender: 'male' | 'female') => {
    setGender(newGender);
    onChange([]); // 切换时清空选择
  };

  return (
    <div>
      {type === 'novel' && (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => handleGenderChange('male')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              gender === 'male'
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            男频
          </button>
          <button
            onClick={() => handleGenderChange('female')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              gender === 'female'
                ? 'bg-pink-100 text-pink-700 border border-pink-200'
                : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
            }`}
          >
            女频
          </button>
          <span className="text-xs text-[var(--ui-muted)] ml-2">
            已选 {safeSelectedThemes.length}/5 个主题
          </span>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <label className="block text-sm font-medium text-stone-700">
          主题 {type === 'shortStory' && '(可多选，最多5个)'}
          <span className="ml-2 text-xs font-normal text-[var(--ui-muted)]">
            {q ? `匹配 ${filteredThemes.length}` : `共 ${safeAvailableThemes.length}`} 个
          </span>
        </label>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--ui-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={themeQuery}
              onChange={(e) => setThemeQuery(e.target.value)}
              placeholder="搜索主题…"
              className="ui-input !py-1.5 !pl-8 !pr-2 text-xs w-40 sm:w-48"
            />
          </div>
          {!q && safeAvailableThemes.length > 15 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-[var(--ui-accent-text)] hover:text-[var(--ui-accent-text)] font-medium whitespace-nowrap"
            >
              {showAll ? '收起' : '展示全部'}
            </button>
          )}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-0.5">
        {displayThemes.map(theme => {
          const isSelected = safeSelectedThemes.includes(theme);
          return (
            <button
              key={theme}
              onClick={() => {
                if (isSelected) {
                  onChange(safeSelectedThemes.filter(t => t !== theme));
                } else {
                  if (safeSelectedThemes.length < 5) onChange([...safeSelectedThemes, theme]);
                  else onMaxReached?.('最多只能选择5个主题');
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isSelected 
                  ? gender === 'female' && type !== 'shortStory'
                    ? 'bg-pink-100 text-pink-700 border border-pink-200'
                    : 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)] border border-[rgba(196,92,38,0.35)]'
                  : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {theme}
            </button>
          );
        })}
      </div>
      {displayThemes.length === 0 && (
        <p className="text-xs text-[var(--ui-muted)] py-3 text-center border border-dashed border-stone-200 rounded-lg mt-1">
          没有匹配「{themeQuery}」的主题，换个关键词试试（主题表未删减）
        </p>
      )}
      
      {safeSelectedThemes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-[var(--ui-muted)]">已选:</span>
          {safeSelectedThemes.map(theme => (
            <span 
              key={theme} 
              className={`px-2 py-0.5 rounded text-xs ${
                gender === 'female' && type !== 'shortStory'
                  ? 'bg-pink-50 text-pink-700'
                  : 'bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)]'
              }`}
            >
              {theme}
              <button 
                onClick={() => onChange(safeSelectedThemes.filter(t => t !== theme))}
                className="ml-1 hover:text-red-500"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
