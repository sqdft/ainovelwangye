import { useState, useEffect, useRef } from 'react';
import { BookOpen, Settings as SettingsIcon, Users, List, FileText, Download, Loader2, Wand2, Play, Feather, RefreshCw, Globe, Upload, MoreHorizontal, ChevronDown, Eye, Pencil, LayoutList, Rows3, Search } from 'lucide-react';
import { Settings, BookInfo, Character, TOCItem, Provider, ShortStoryInfo, Realm, SubRealm, RealmProgress, ModelInfo, NovelMemory } from './types';
import { dualGet, dualSet, dualClearAll } from './lib/storage';
import { normalizeBaseUrl, proxyFetch } from './lib/devProxy';
import { generateBookInfo, generateCharacters, generateRealms, generateTOC, generateChapterContent, generateShortStoryContent, generateShortStoryTitles, generateShortStoryOutlineFromTitle, generateShortStorySegments, generateBookTitles, updateNovelMemory } from './services/aiService';
import { PROVIDERS, getProviderConfig } from './config/providers';
import { MALE_THEME_NAMES, FEMALE_THEME_NAMES, SHORT_STORY_THEME_NAMES } from './config/themes';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { saveAs } from 'file-saver';

type Tab = 'settings' | 'book' | 'characters' | 'realms' | 'toc' | 'chapters' | 'examples';
type Mode = 'novel' | 'shortStory';

const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
  { label: '自定义', value: 'custom', count: 100 },
];


const REALM_RECOMMENDED_THEMES = ['玄幻', '修仙', '仙侠', '高武', '异能', '洪荒', '系统', '穿越', '重生', '升级流', '游戏', '灵气复苏', '武道', '武侠', '奇幻'];
const REALM_DISCOURAGED_THEMES = ['都市', '言情', '悬疑', '推理', '规则怪谈', '现实', '职场', '校园', '甜宠', '霸总', '年代', '种田', '美食', '综艺'];

function themesRecommendRealms(themes: string[] = []): 'recommend' | 'optional' | 'hide' {
  const joined = themes.join(' ');
  if (REALM_RECOMMENDED_THEMES.some(t => joined.includes(t))) return 'recommend';
  if (REALM_DISCOURAGED_THEMES.some(t => joined.includes(t))) return 'hide';
  return 'optional';
}

function getRealmSystemLabel(themes: string[] = []): { title: string; hint: string; generateLabel: string } {
  const mode = themesRecommendRealms(themes);
  if (mode === 'recommend') {
    return {
      title: '力量 / 境界体系',
      hint: '当前题材较适合完整力量等级。可生成大境界、小境界与突破节点。',
      generateLabel: 'AI 生成境界',
    };
  }
  if (mode === 'hide') {
    return {
      title: '世界规则（可选）',
      hint: '都市/悬疑/言情等题材默认不必做修炼境界。如需，可生成身份阶层、组织权限或怪谈规则。',
      generateLabel: 'AI 生成世界规则',
    };
  }
  return {
    title: '等级 / 世界规则（可选）',
    hint: '可按题材生成力量等级、职业阶层或组织规则；不需要可关闭。',
    generateLabel: 'AI 生成规则体系',
  };
}

function normalizeSummaryForCompare(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：""''（）()【】\[\]《》…—\-_,.!?;:'"]+/g, '')
    .slice(0, 120);
}

function summarySimilarity(a: string, b: string): number {
  const sa = normalizeSummaryForCompare(a);
  const sb = normalizeSummaryForCompare(b);
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  if (sa.includes(sb) || sb.includes(sa)) return 0.9;
  const gram = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = gram(sa);
  const B = gram(sb);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter += 1; });
  return inter / Math.max(A.size, B.size);
}

function findSimilarSummaries(
  items: { chapterNumber: number; title: string; summary: string }[],
  existing: { summary: string; chapterNumber: number; title: string }[] = [],
  threshold = 0.42
) {
  const warnings: string[] = [];
  const pool = [...existing];
  for (const item of items) {
    for (const prev of pool) {
      const score = summarySimilarity(item.summary, prev.summary);
      if (score >= threshold) {
        warnings.push(
          `第${item.chapterNumber}章「${item.title}」与第${prev.chapterNumber}章「${prev.title}」剧情摘要疑似重复（相似度 ${Math.round(score * 100)}%）`
        );
      }
    }
    pool.push(item);
  }
  return warnings;
}

function useDualStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [loaded, setLoaded] = useState(false);
  const storedValueRef = useRef(storedValue);
  storedValueRef.current = storedValue;

  // 首次加载：从 IndexedDB/localStorage 读取
  useEffect(() => {
    dualGet<T>(key, initialValue).then(val => {
      setStoredValue(val);
      storedValueRef.current = val;
      setLoaded(true);
    });
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValueRef.current) : value;
    setStoredValue(valueToStore);
    storedValueRef.current = valueToStore;
    dualSet(key, valueToStore);
  };

  // 未加载完时返回初始值
  return [loaded ? storedValue : initialValue, setValue];
}

const ThemeSelector = ({ 
  selectedThemes, 
  onChange,
  type = 'novel'
}: { 
  selectedThemes: string[], 
  onChange: (themes: string[]) => void,
  type?: 'novel' | 'shortStory'
}) => {
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
                  else alert('最多只能选择5个主题');
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
};

export default function App() {
  const [mode, setMode] = useDualStorage<Mode>('ai_novel_mode', 'novel');
  const [activeTab, setActiveTab] = useDualStorage<Tab>('ai_novel_activeTab', 'settings');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingChapterNum, setGeneratingChapterNum] = useState<number | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const [tocCompact, setTocCompact] = useState(true);
  const [tocMenuOpen, setTocMenuOpen] = useState<number | null>(null);
  const [chapterReadMode, setChapterReadMode] = useState(true);
  const [showShortResetMenu, setShowShortResetMenu] = useState(false);
  const stopBatchRef = useRef(false);

  // Settings State
  const [settings, setSettings] = useDualStorage<Settings>('ai_novel_settings', {
    provider: 'gemini',
    apiKey: '',
    apiKeys: [], // 多密钥轮询列表
    currentKeyIndex: 0, // 当前使用的密钥索引
    baseUrl: PROVIDERS['gemini'].baseUrl,
    model: PROVIDERS['gemini'].model,
    availableModels: [], // 可用模型列表
    minWordCount: 2000,
    temperature: 0.9, // 默认 0.9，较高的创作自由度
  });

  // 确保旧数据也有所有必需字段
  useEffect(() => {
    const needsUpdate = 
      settings.temperature === undefined ||
      !settings.apiKeys ||
      !settings.availableModels;

    if (needsUpdate) {
      setSettings({
        ...settings,
        temperature: settings.temperature ?? 0.9,
        apiKeys: settings.apiKeys ?? [],
        availableModels: settings.availableModels ?? [],
        currentKeyIndex: settings.currentKeyIndex ?? 0,
      });
    }
  }, []);

  // Novel State
  const [bookInfo, setBookInfo] = useDualStorage<BookInfo>('ai_novel_bookInfo', {
    title: '',
    themes: [MALE_THEME_NAMES[0]],
    lengthType: '100',
    targetChapterCount: 100,
    outline: '',
    worldbuilding: '',
    endingOutline: '',
    titleOptions: [],
    isTitleSelected: false,
    enableRealms: themesRecommendRealms([MALE_THEME_NAMES[0]]) === 'recommend' // 按题材建议
  });
  const [characters, setCharacters] = useDualStorage<Character[]>('ai_novel_characters', []);
  const [realmProgress, setRealmProgress] = useDualStorage<RealmProgress>('ai_novel_realmProgress', {
    realms: [],
    protagonistCurrentRealmIndex: 0,
    protagonistCurrentSubRealmIndex: 0,
    chapterRealmMap: {}
  });
  const [toc, setToc] = useDualStorage<TOCItem[]>('ai_novel_toc', []);
  const [chapters, setChapters] = useDualStorage<Record<number, string>>('ai_novel_chapters', {});
  const [activeChapterNum, setActiveChapterNum] = useDualStorage<number | null>('ai_novel_activeChapterNum', null);
  const [novelMemory, setNovelMemory] = useDualStorage<NovelMemory>('ai_novel_memory', {
    storySoFar: '',
    characterStates: '',
    openThreads: [],
    resolvedThreads: [],
    importantItems: [],
    lastUpdatedChapter: 0
  });

  // Short Story State
  const [shortStoryInfo, setShortStoryInfo] = useDualStorage<ShortStoryInfo>('ai_novel_shortStoryInfo', {
    title: '',
    themes: [SHORT_STORY_THEME_NAMES[0]],
    targetWordCount: 10000,
    outline: '',
    content: '',
    segments: [],
    currentSegment: 0,
    isOutlineGenerated: false
  });
  const [shortStoryTitleOptions, setShortStoryTitleOptions] = useDualStorage<string[]>('ai_novel_shortStoryTitleOptions', []);

  // Handlers
  const handleProviderChange = (provider: Provider) => {
    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      console.error('Provider config not found:', provider);
      return;
    }

    const newSettings: Partial<Settings> = {
      provider,
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.model,
    };

    // 切换到免费提供商时，将单密钥复制到多密钥列表（如果多密钥为空）
    if (provider === 'free' && (!settings.apiKeys || settings.apiKeys.length === 0) && settings.apiKey) {
      newSettings.apiKeys = [settings.apiKey];
    }

    // 从免费提供商切换回其他时，将第一个多密钥复制到单密钥
    if (provider !== 'free' && settings.provider === 'free' && settings.apiKeys && settings.apiKeys.length > 0) {
      newSettings.apiKey = settings.apiKeys[0];
    }

    setSettings({ ...settings, ...newSettings });
  };

  const handleDetectModels = async () => {
    if (settings.provider === 'gemini') {
      alert('Gemini 不支持模型检测，请手动输入模型名称');
      return;
    }

    if (!settings.baseUrl) {
      alert('请先设置 Base URL');
      return;
    }

    const apiKey = settings.provider === 'free' && settings.apiKeys && settings.apiKeys.length > 0
      ? settings.apiKeys[settings.currentKeyIndex || 0] || settings.apiKeys[0]
      : settings.apiKey;

    if (!apiKey && settings.provider !== 'kilo') {
      alert('请先设置 API Key');
      return;
    }

    setIsGenerating(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const modelsUrl = `${normalizeBaseUrl(settings.baseUrl)}/models`;
      const res = await proxyFetch(modelsUrl, {
        method: 'GET',
        headers
      });

      if (!res.ok) {
        throw new Error(`API 请求失败 (${res.status})`);
      }

      const data = await res.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('API 返回格式异常');
      }

      const models: ModelInfo[] = data.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        provider: settings.provider,
        contextLength: m.context_window
      }));

      setSettings({ ...settings, availableModels: models });
      alert(`检测成功！共发现 ${models.length} 个可用模型`);
    } catch (error: any) {
      alert(`模型检测失败: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const emptyNovelMemory: NovelMemory = {
    storySoFar: '',
    characterStates: '',
    openThreads: [],
    resolvedThreads: [],
    importantItems: [],
    lastUpdatedChapter: 0
  };

  const hasNovelDownstreamData = () => {
    return characters.length > 0 || realmProgress.realms.length > 0 || toc.length > 0 || Object.keys(chapters).length > 0 || !!novelMemory.storySoFar;
  };

  const clearNovelDownstream = (level: 'book' | 'toc' | 'chapters') => {
    if (level === 'book') {
      setCharacters([]);
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
      setToc([]);
    }
    if (level === 'toc') {
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
      setToc([]);
    }
    setChapters({});
    setActiveChapterNum(null);
    setNovelMemory(emptyNovelMemory);
  };

  const confirmAndClearNovelDownstream = (message: string, level: 'book' | 'toc' | 'chapters') => {
    if (!hasNovelDownstreamData()) return true;
    if (!confirm(message)) return false;
    clearNovelDownstream(level);
    return true;
  };

  const handleLengthChange = (lengthType: string) => {
    if (!confirmAndClearNovelDownstream('修改篇幅会影响目录、境界推进和已生成正文。是否清空这些下游内容？', 'toc')) {
      return;
    }
    const count = LENGTHS.find(l => l.value === lengthType)?.count || 100;
    setBookInfo({ ...bookInfo, lengthType, targetChapterCount: count });
  };

  const handleBookThemesChange = (themes: string[]) => {
    if (!confirmAndClearNovelDownstream('修改主题会影响书籍设定、人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    const realmMode = themesRecommendRealms(themes);
    setBookInfo({
      ...bookInfo,
      themes,
      titleOptions: [],
      isTitleSelected: false,
      title: '',
      outline: '',
      worldbuilding: '',
      enableRealms: realmMode === 'recommend',
    });
    if (realmMode !== 'recommend') {
      setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
    }
  };

  const handleBookTitleInput = (title: string) => {
    if (title !== bookInfo.title && !confirmAndClearNovelDownstream('修改书名会影响人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    setBookInfo({...bookInfo, title, isTitleSelected: !!title});
  };

  const handleBookPlanningFieldChange = (field: 'outline' | 'worldbuilding', value: string) => {
    if (value !== bookInfo[field] && !confirmAndClearNovelDownstream('修改大纲或世界观会影响人物、目录和正文。是否清空这些下游内容？', 'book')) {
      return;
    }
    setBookInfo({ ...bookInfo, [field]: value });
  };

  // 生成书名选项（新增）
  const handleGenerateBookTitles = async () => {
    if (!bookInfo.themes || bookInfo.themes.length === 0) {
      alert('请先选择至少一个主题！');
      return;
    }
    setIsGenerating(true);
    try {
      const titles = await generateBookTitles(bookInfo.themes, bookInfo.lengthType, settings, bookInfo.targetChapterCount);
      setBookInfo({ ...bookInfo, titleOptions: titles, isTitleSelected: false, title: '' });
      alert(`成功生成 ${titles.length} 个书名选项！请选择一个您喜欢的书名。`);
    } catch (error: any) {
      alert(error.message || '生成书名失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 选择书名（新增）
  const handleSelectBookTitle = (title: string) => {
    if (title !== bookInfo.title && !confirmAndClearNovelDownstream('切换书名会清空人物、目录和正文，避免新旧设定混用。是否继续？', 'book')) {
      return;
    }
    setBookInfo({ ...bookInfo, title, isTitleSelected: true, titleOptions: [] }); // 选择后清空选项，让卡片消失
  };

  const handleGenerateBookInfo = async () => {
    // 检查是否已选择书名
    if (!bookInfo.isTitleSelected || !bookInfo.title) {
      alert('请先生成并选择一个书名！');
      return;
    }
    setIsGenerating(true);
    try {
      const info = await generateBookInfo(bookInfo, settings);
      clearNovelDownstream('book');
      setBookInfo({ ...bookInfo, ...info });
      setActiveTab('book');
    } catch (error: any) {
      alert(error.message || '生成书籍信息失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateCharacters = async () => {
    if (!bookInfo.title || !bookInfo.outline) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    setIsGenerating(true);
    try {
      const chars = await generateCharacters(bookInfo, settings);
      clearNovelDownstream('toc');
      setCharacters(chars);
      setActiveTab('characters');
    } catch (error: any) {
      alert(error.message || '生成人物关系失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 生成境界体系
  const handleGenerateRealms = async () => {
    if (!bookInfo.title || !characters || characters.length === 0) {
      alert('请先生成书籍信息和人物！');
      return;
    }
    setIsGenerating(true);
    try {
      const realms = await generateRealms(bookInfo, characters, settings);
      // 自动分配突破节点：大境界+小境界，前期快后期慢
      const totalChapters = bookInfo.targetChapterCount;
      // 计算总突破节点数：每个大境界的小境界数之和（不含起始大境界的第0个小境界）
      const totalBreakpoints = realms.reduce((sum, r, idx) => {
        if (idx === 0) return sum + (r.subRealms?.length ? r.subRealms.length - 1 : 0); // 起始大境界跳过第0个小境界
        return sum + (r.subRealms?.length || 1); // 其他大境界包含所有小境界
      }, 0);
      const chapterRealmMap: Record<number, { realmIndex: number; subRealmIndex: number }> = {};
      let bpIdx = 0;
      const usedChapters = new Set<number>();
      if (totalBreakpoints > 0) {
        realms.forEach((realm, rIdx) => {
          const subCount = realm.subRealms?.length || 1;
          const startSub = rIdx === 0 ? 1 : 0; // 起始大境界从第1个小境界开始
          for (let sIdx = startSub; sIdx < subCount; sIdx++) {
            bpIdx++;
            const t = bpIdx / totalBreakpoints;
            const curvedT = Math.pow(t, 1.3);
            let chapter = Math.min(Math.max(Math.round(curvedT * totalChapters), bpIdx * 3), totalChapters);
            while (usedChapters.has(chapter) && chapter < totalChapters) chapter++;
            while (usedChapters.has(chapter) && chapter > 1) chapter--;
            usedChapters.add(chapter);
            chapterRealmMap[chapter] = { realmIndex: rIdx, subRealmIndex: sIdx };
          }
        });
      } else {
        realms.slice(1).forEach((_, idx) => {
          const chapter = Math.min(totalChapters, Math.max(1, Math.round(((idx + 1) / realms.length) * totalChapters)));
          chapterRealmMap[chapter] = { realmIndex: idx + 1, subRealmIndex: 0 };
        });
      }
      setRealmProgress({
        realms,
        protagonistCurrentRealmIndex: 0,
        protagonistCurrentSubRealmIndex: 0,
        chapterRealmMap
      });
      setActiveTab('realms');
    } catch (error: any) {
      alert(error.message || '生成境界体系失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 手动添加人物
  const handleAddCharacter = () => {
    const newCharacter: Character = {
      id: Date.now().toString(),
      name: '',
      role: '配角',
      description: ''
    };
    setCharacters([...characters, newCharacter]);
  };

  // 删除人物
  const handleDeleteCharacter = (id: string) => {
    if (!characters || characters.length <= 1) {
      alert('至少保留一个角色');
      return;
    }
    setCharacters(characters.filter(c => c.id !== id));
  };

  // 更新人物
  const handleUpdateCharacter = (id: string, field: keyof Character, value: string) => {
    setCharacters(characters.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleGenerateTOC = async () => {
    if (!bookInfo.title || !characters || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    
    const startIndex = toc.length + 1;
    if (startIndex > bookInfo.targetChapterCount) {
      alert('已生成全部目录！');
      return;
    }

    setIsGenerating(true);
    try {
      const batchSize = 30;
      const existingTitles = toc.map(item => item.title);
      const existingSummaries = toc.map(item => item.summary);
      const newChapters = await generateTOC(bookInfo, characters, settings, startIndex, batchSize, existingTitles, existingSummaries);
      const similar = findSimilarSummaries(newChapters, toc);
      if (similar.length > 0) {
        alert(`本批目录已生成，但发现剧情摘要疑似重复：\n${similar.slice(0, 5).join('\n')}${similar.length > 5 ? '\n…共 ' + similar.length + ' 条' : ''}\n\n可在大纲目录中手动改写摘要后继续。`);
      }
      setToc([...toc, ...newChapters]);
      setActiveTab('toc');
    } catch (error: any) {
      alert(error.message || '生成目录大纲失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 只生成单章目录（接在末尾）
  const handleGenerateSingleChapterOutline = async () => {
    if (!bookInfo.title || !characters || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }
    
    const nextChapterNum = toc.length + 1;
    if (nextChapterNum > bookInfo.targetChapterCount) {
      alert('已生成全部目录！');
      return;
    }

    setIsGenerating(true);
    try {
      const existingTitles = toc.map(item => item.title);
      // 只生成1章
      const newChapters = await generateTOC(bookInfo, characters, settings, nextChapterNum, 1, existingTitles, toc.map(item => item.summary));
      if (newChapters.length > 0) {
        setToc([...toc, ...newChapters]);
        alert(`第${nextChapterNum}章目录生成成功！`);
      }
    } catch (error: any) {
      alert(error.message || '生成单章目录失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 删除指定目录项
  const handleDeleteTOCItem = (chapterNum: number) => {
    if (!confirm(`确定要删除第${chapterNum}章的目录标题和大纲吗？\n删除后该章节的内容也会被清空。`)) {
      return;
    }
    
    // 删除目录项（不重新编号，保持原有章节号）
    const updatedTOC = toc.filter(item => item.chapterNumber !== chapterNum);
    setToc(updatedTOC);
    
    // 删除对应章节内容
    const updatedChapters = { ...chapters };
    delete updatedChapters[chapterNum];
    setChapters(updatedChapters);
  };

  // 重新生成指定章节的目录
  const handleRegenerateChapterOutline = async (chapterNum: number) => {
    if (!bookInfo.title || !characters || characters.length === 0) {
      alert('请先生成或填写书籍信息！');
      return;
    }

    setIsGenerating(true);
    try {
      // 获取其他章节的标题（不包括当前要重新生成的）
      const existingTitles = toc
        .filter(item => item.chapterNumber !== chapterNum)
        .map(item => item.title);
      
      // 生成新标题
      const newChapters = await generateTOC(bookInfo, characters, settings, chapterNum, 1, existingTitles, toc.map(item => item.summary));
      if (newChapters.length > 0) {
        // 替换原目录项
        const updatedTOC = toc.map(item => 
          item.chapterNumber === chapterNum ? newChapters[0] : item
        );
        setToc(updatedTOC);
        
        // 清空该章内容（因为大纲变了）
        const updatedChapters = { ...chapters };
        delete updatedChapters[chapterNum];
        setChapters(updatedChapters);
        
        alert(`第${chapterNum}章目录已重新生成！`);
      }
    } catch (error: any) {
      alert(error.message || '重新生成目录失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 编辑目录标题
  const handleEditChapterTitle = (chapterNum: number, newTitle: string) => {
    const updatedTOC = toc.map(item => 
      item.chapterNumber === chapterNum ? { ...item, title: newTitle } : item
    );
    setToc(updatedTOC);
  };

  const countTextLength = (text: string) => text.replace(/\s/g, '').length;

  const findDuplicateRisk = (content: string, previousContent?: string) => {
    if (!previousContent) return false;
    const cleanCurrent = content.replace(/\s/g, '');
    const cleanPrevious = previousContent.replace(/\s/g, '');
    if (cleanCurrent.length < 120 || cleanPrevious.length < 120) return false;
    for (let i = 0; i <= Math.min(cleanCurrent.length - 80, 800); i += 20) {
      const sample = cleanCurrent.slice(i, i + 80);
      if (sample && cleanPrevious.includes(sample)) return true;
    }
    return false;
  };

  const validateChapterContent = (content: string, tocItem: TOCItem, previousContent?: string) => {
    const warnings: string[] = [];
    const textLength = countTextLength(content);
    const min = settings.minWordCount || 2000;
    if (textLength < min * 0.7) warnings.push(`正文偏短：约 ${textLength} 字，低于目标 ${min} 字较多`);
    if (textLength > min * 1.6) warnings.push(`正文偏长：约 ${textLength} 字，明显超过目标 ${min} 字`);
    if (content.trim().startsWith(`第${tocItem.chapterNumber}章`) || content.trim().startsWith(tocItem.title)) {
      warnings.push('正文开头疑似包含章节标题，建议删除标题后再导出');
    }
    if (findDuplicateRisk(content, previousContent)) {
      warnings.push('正文与上一章存在较长重复片段，建议检查衔接处');
    }
    if (tocItem.chapterNumber === bookInfo.targetChapterCount && /刚刚开始|真正的风暴|新的征程|未完待续/.test(content.slice(-300))) {
      warnings.push('最终章结尾仍像悬念钩子，建议重新生成或手动收尾');
    }
    return warnings;
  };

  const generateChapterWithQualityGate = async (tocItem: TOCItem, currentChapters: Record<number, string>, memory: NovelMemory = novelMemory) => {
    const previousContents: string[] = [];
    for (let i = 1; i < tocItem.chapterNumber; i++) {
      if (currentChapters[i]) previousContents.push(currentChapters[i]);
    }
    const previousContent = previousContents[previousContents.length - 1];
    const activeRealmProgress = bookInfo.enableRealms !== false ? realmProgress : undefined;
    const content = await generateChapterContent(bookInfo, characters, tocItem, previousContents, settings, toc, activeRealmProgress, memory);
    if (!content.trim()) {
      throw new Error('AI 返回的章节正文为空，请重试。');
    }
    const warnings = validateChapterContent(content, tocItem, previousContent);
    if (warnings.length > 0) {
      alert(`第${tocItem.chapterNumber}章已生成，但发现质量提醒：\n${warnings.join('\n')}`);
    }
    let nextMemory = memory;
    try {
      nextMemory = await updateNovelMemory(memory, bookInfo, tocItem, content, settings);
      setNovelMemory(nextMemory);
    } catch (error) {
      console.warn('更新全书记忆失败，本章正文已保留:', error);
    }
    return { content, nextMemory };
  };

  const handleGenerateChapter = async (chapterNum: number) => {
    const tocItem = toc.find(t => t.chapterNumber === chapterNum);
    if (!tocItem) return;

    setIsGenerating(true);
    setGeneratingChapterNum(chapterNum);
    try {
      const { content } = await generateChapterWithQualityGate(tocItem, chapters);
      setChapters(prev => ({ ...prev, [chapterNum]: content }));
      setActiveChapterNum(chapterNum);
      setActiveTab('chapters');
    } catch (error: any) {
      alert(error.message || '生成章节内容失败');
    } finally {
      setGeneratingChapterNum(null);
      setIsGenerating(false);
    }
  };

  // 删除指定章节
  const handleDeleteChapter = (chapterNum: number) => {
    if (!confirm(`确定要删除第${chapterNum}章及其内容吗？\n删除后将无法恢复，该章节后续章节编号不会自动调整。`)) {
      return;
    }
    
    // 删除章节内容
    const updatedChapters = { ...chapters };
    delete updatedChapters[chapterNum];
    setChapters(updatedChapters);
    
    // 如果删除的是当前显示的章节，重置显示状态
    if (activeChapterNum === chapterNum) {
      const remainingKeys = Object.keys(updatedChapters).map(Number).sort((a, b) => a - b);
      if (remainingKeys.length > 0) {
        setActiveChapterNum(remainingKeys[0]);
      } else {
        setActiveChapterNum(1);
      }
    }
  };

  // 删除所有章节内容
  const handleDeleteAllChapters = () => {
    if (!confirm('确定要删除所有已生成的章节内容吗？\n这将清空所有章节正文，但保留目录大纲。')) {
      return;
    }
    setChapters({});
    setActiveChapterNum(1);
  };

  const handleBatchGenerateChapters = async () => {
    const ungenerated = toc.filter(t => !chapters[t.chapterNumber]);
    const toGenerate = ungenerated.slice(0, 20);
    
    if (toGenerate.length === 0) {
      alert('当前目录中的所有章节都已生成！请先生成更多目录。');
      return;
    }

    setIsGenerating(true);
    setIsBatchGenerating(true);
    stopBatchRef.current = false;
    
    let currentChapters = { ...chapters };
    let currentMemory = novelMemory;

    for (const item of toGenerate) {
      if (stopBatchRef.current) break;
      setGeneratingChapterNum(item.chapterNumber);
      setActiveChapterNum(item.chapterNumber);
      try {
        const { content, nextMemory } = await generateChapterWithQualityGate(item, currentChapters, currentMemory);
        currentMemory = nextMemory;
        currentChapters = { ...currentChapters, [item.chapterNumber]: content };
        setChapters(prev => ({ ...prev, [item.chapterNumber]: content }));
      } catch (error: any) {
        alert(`生成第${item.chapterNumber}章失败: ${error.message}`);
        break;
      }
    }
    setGeneratingChapterNum(null);
    setIsBatchGenerating(false);
    setIsGenerating(false);
  };

  const handleStopBatchGenerate = () => {
    stopBatchRef.current = true;
  };

  // Short Story Handlers
  const handleGenerateShortStoryTitles = async () => {
    if (!shortStoryInfo.themes || shortStoryInfo.themes.length === 0) {
      alert('请先选择至少一个主题！');
      return;
    }
    setIsGenerating(true);
    try {
      const titles = await generateShortStoryTitles(shortStoryInfo.themes, settings);
      setShortStoryTitleOptions(titles);
    } catch (error: any) {
      alert(error.message || '生成标题失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateShortStoryOutline = async () => {
    if (!shortStoryInfo.title) {
      alert('请先填写或选择一个故事标题！');
      return;
    }
    setIsGenerating(true);
    try {
      // 生成分段大纲
      const segments = await generateShortStorySegments(shortStoryInfo, settings);
      const outlineText = segments.map(s => `${s.segmentNumber}. ${s.title}：${s.summary}`).join('\n');
      setShortStoryInfo({
        ...shortStoryInfo,
        segments,
        isOutlineGenerated: true,
        outline: shortStoryInfo.outline ? `${shortStoryInfo.outline}\n\n【AI 分段规划】\n${outlineText}` : outlineText
      });
    } catch (error: any) {
      alert(error.message || '生成大纲失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 检测并去除新生成内容与已有内容的重复部分（增强版）
  const removeDuplicateContent = (existingContent: string, newContent: string): string => {
    if (!existingContent) return newContent;
    
    // 将内容按段落分割
    const existingParagraphs = existingContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    const newParagraphs = newContent.split(/\n\n+/).filter(p => p.trim().length > 10);
    
    // 检查新内容的每个段落是否与已有内容高度相似
    const uniqueParagraphs: string[] = [];
    let foundDuplicate = false;
    
    // 计算两个字符串的相似度（Levenshtein距离的简化版）
    const calculateSimilarity = (str1: string, str2: string): number => {
      const len1 = str1.length;
      const len2 = str2.length;
      if (len1 === 0 || len2 === 0) return 0;
      
      // 使用滑动窗口找最长公共子串
      let maxMatch = 0;
      const minLen = Math.min(len1, len2);
      
      for (let i = 0; i < len1 - 20; i++) {
        const substr = str1.slice(i, i + 20);
        if (str2.includes(substr)) {
          maxMatch = Math.max(maxMatch, 20);
        }
      }
      
      return maxMatch / minLen;
    };
    
    for (const newPara of newParagraphs) {
      const newParaClean = newPara.trim().replace(/\s+/g, '');
      let isDuplicate = false;
      
      // 与已有内容的最后10个段落比较（扩大检测范围）
      const recentExisting = existingParagraphs.slice(-10);
      for (const existPara of recentExisting) {
        const existParaClean = existPara.trim().replace(/\s+/g, '');
        
        // 跳过太短的段落
        if (newParaClean.length < 20 || existParaClean.length < 20) continue;
        
        // 方法1: 检查前50字是否重复（提高检测长度）
        const prefixLen = Math.min(50, newParaClean.length, existParaClean.length);
        if (prefixLen >= 30) {
          const newPrefix = newParaClean.slice(0, prefixLen);
          const existPrefix = existParaClean.slice(0, prefixLen);
          if (newPrefix === existPrefix) {
            isDuplicate = true;
            foundDuplicate = true;
            break;
          }
        }
        
        // 方法2: 检查是否有长度超过30的公共子串
        if (newParaClean.length >= 30 && existParaClean.length >= 30) {
          for (let i = 0; i <= newParaClean.length - 30; i++) {
            const substr = newParaClean.slice(i, i + 30);
            if (existParaClean.includes(substr)) {
              isDuplicate = true;
              foundDuplicate = true;
              break;
            }
          }
          if (isDuplicate) break;
        }
        
        // 方法3: 计算整体相似度（相似度超过60%认为重复）
        const similarity = calculateSimilarity(newParaClean, existParaClean);
        if (similarity > 0.6) {
          isDuplicate = true;
          foundDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueParagraphs.push(newPara);
      }
    }
    
    // 如果检测到重复，提示用户
    if (foundDuplicate) {
      console.warn('检测到重复内容，已自动去除');
    }
    
    return uniqueParagraphs.join('\n\n');
  };

  // 生成/续写短篇：按分段规划逐段推进
  const handleGenerateShortStoryContent = async (options?: { segmentIndex?: number; rewrite?: boolean; forceFinal?: boolean }) => {
    if (!shortStoryInfo.outline && (!shortStoryInfo.segments || shortStoryInfo.segments.length === 0)) {
      alert('请先填写故事核心脑洞/大纲，或生成分段规划！');
      return;
    }

    const segments = shortStoryInfo.segments || [];
    let targetIndex = options?.segmentIndex;
    if (targetIndex === undefined) {
      targetIndex = segments.findIndex(s => !s.isGenerated);
      if (targetIndex < 0) targetIndex = Math.min(shortStoryInfo.currentSegment || 0, Math.max(segments.length - 1, 0));
    }
    const rewrite = !!options?.rewrite;
    const isLastSegment = segments.length === 0
      ? !!options?.forceFinal
      : targetIndex >= segments.length - 1;
    const isFinalBatch = options?.forceFinal ?? isLastSegment;

    setIsGenerating(true);
    try {
      const MAX_CONTEXT_LENGTH = 1500;
      let context = shortStoryInfo.content || '';
      // 重写当前段：去掉该段及之后内容（按已生成段拼接）
      if (rewrite && segments.length > 0) {
        const kept = segments
          .filter((s, i) => i < targetIndex! && s.isGenerated && s.content)
          .map(s => s.content)
          .join('\n\n');
        context = kept;
      }
      if (context.length > MAX_CONTEXT_LENGTH) {
        context = context.slice(-MAX_CONTEXT_LENGTH);
      }

      const infoForGen = {
        ...shortStoryInfo,
        currentSegment: targetIndex || 0,
      };
      const newContent = await generateShortStoryContent(infoForGen, context, settings, isFinalBatch, targetIndex);

      const cleanedContent = removeDuplicateContent(context, newContent);
      if (cleanedContent.trim().length < 50 && newContent.trim().length > 100) {
        alert('检测到生成内容与已有内容高度重复，已跳过重复部分。建议重写当前段，或调整分段摘要后再生成。');
      }

      let nextSegments = segments;
      if (segments.length > 0) {
        nextSegments = segments.map((s, i) => {
          if (i !== targetIndex) return s;
          return {
            ...s,
            content: cleanedContent,
            isGenerated: true,
          };
        });
        // 重写时清空后续段的生成标记（正文将重建）
        if (rewrite) {
          nextSegments = nextSegments.map((s, i) => i > targetIndex! ? { ...s, content: '', isGenerated: false } : s);
        }
      }

      const rebuiltContent = nextSegments.length > 0
        ? nextSegments.filter(s => s.isGenerated && s.content).map(s => s.content).join('\n\n')
        : (rewrite ? cleanedContent : (shortStoryInfo.content ? shortStoryInfo.content + '\n\n' + cleanedContent : cleanedContent));

      const nextIndex = nextSegments.length > 0
        ? Math.min((targetIndex || 0) + (rewrite ? 0 : 1), nextSegments.length)
        : (shortStoryInfo.currentSegment || 0) + 1;

      setShortStoryInfo({
        ...shortStoryInfo,
        content: rebuiltContent,
        segments: nextSegments,
        currentSegment: nextIndex,
      });
      setActiveTab('chapters');
    } catch (error: any) {
      alert(error.message || '生成故事内容失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'txt' | 'docx' = 'txt') => {
    if (mode === 'novel') {
      if (Object.keys(chapters).length === 0) return;
      
      if (format === 'docx') {
        await downloadNovelAsWord();
      } else {
        let fullText = `《${bookInfo.title || '未命名小说'}》\n\n`;
        toc.forEach(item => {
          if (chapters[item.chapterNumber]) {
            fullText += `第${item.chapterNumber}章 ${item.title}\n\n${chapters[item.chapterNumber]}\n\n`;
          }
        });
        downloadText(fullText, `${bookInfo.title || '小说'}.txt`);
      }
    } else {
      if (!shortStoryInfo.content) return;
      
      if (format === 'docx') {
        await downloadShortStoryAsWord();
      } else {
        let fullText = `《${shortStoryInfo.title || '未命名短篇'}》\n\n${shortStoryInfo.content}`;
        downloadText(fullText, `${shortStoryInfo.title || '短篇故事'}.txt`);
      }
    }
  };

  const downloadNovelAsWord = async () => {
    const paragraphs: Paragraph[] = [];
    
    // 添加标题
    paragraphs.push(
      new Paragraph({
        text: bookInfo.title || '未命名小说',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    // 添加每一章
    toc.forEach(item => {
      if (chapters[item.chapterNumber]) {
        // 章节标题
        paragraphs.push(
          new Paragraph({
            text: `第${item.chapterNumber}章 ${item.title}`,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 }
          })
        );
        
        // 章节内容 - 按段落分割
        const content = chapters[item.chapterNumber];
        const contentParagraphs = content.split(/\n+/).filter(p => p.trim());
        
        contentParagraphs.forEach(para => {
          paragraphs.push(
            new Paragraph({
              text: para.trim(),
              spacing: { after: 200 },
              indent: { firstLine: 480 } // 首行缩进2字符
            })
          );
        });
        
        // 章节之间添加空行
        paragraphs.push(new Paragraph({ text: '' }));
      }
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${bookInfo.title || '小说'}.docx`);
  };

  const downloadShortStoryAsWord = async () => {
    const paragraphs: Paragraph[] = [];
    
    // 添加标题
    paragraphs.push(
      new Paragraph({
        text: shortStoryInfo.title || '未命名短篇',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );
    
    // 添加内容 - 按段落分割
    const contentParagraphs = shortStoryInfo.content.split(/\n+/).filter(p => p.trim());
    
    contentParagraphs.forEach(para => {
      paragraphs.push(
        new Paragraph({
          text: para.trim(),
          spacing: { after: 200 },
          indent: { firstLine: 480 } // 首行缩进2字符
        })
      );
    });
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs
      }]
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${shortStoryInfo.title || '短篇故事'}.docx`);
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Renderers
  const renderSettings = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="ui-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] uppercase text-[var(--ui-accent-text)]">写作引擎</p>
            <h2 className="text-xl font-semibold text-[var(--ui-ink)] mt-1">API & 模型设置</h2>
            <p className="text-sm text-[var(--ui-muted)] mt-1">配置会自动保存到本机，开始写作前可先检测可用模型。</p>
          </div>
          <span className="ui-status-pill self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ui-success)]" />
            已自动保存
          </span>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">AI 供应商</label>
            <select 
              value={settings.provider}
              onChange={(e) => handleProviderChange(e.target.value as Provider)}
              className="w-full ui-input"
            >
              {Object.entries(PROVIDERS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {settings.provider !== 'gemini' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Base URL</label>
              <input 
                type="text" 
                value={settings.baseUrl || ''}
                onChange={(e) => setSettings({...settings, baseUrl: e.target.value})}
                className="w-full ui-input"
              />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-stone-700">
                {settings.provider === 'free' ? 'API Keys (轮询)' : 'API Key'}
              </label>
              <a 
                href="https://pan.quark.cn/s/12ccdf62ccd8" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-[var(--ui-accent-text)] hover:text-[var(--ui-accent-text)] font-medium"
              >
                获取免费 Token
              </a>
            </div>
            
            {settings.provider === 'free' ? (
              // 免费提供商：多密钥输入
              <div className="space-y-2">
                {(!settings.apiKeys || settings.apiKeys.length === 0) ? (
                  <div className="text-sm text-[var(--ui-muted)] italic">点击下方按钮添加密钥，支持添加多个密钥自动轮询</div>
                ) : (
                  settings.apiKeys.map((key, index) => (
                    <div key={index} className="flex gap-2">
                      <input 
                        type="password" 
                        value={key}
                        onChange={(e) => {
                          const newKeys = [...(settings.apiKeys || [])];
                          newKeys[index] = e.target.value;
                          setSettings({...settings, apiKeys: newKeys});
                        }}
                        placeholder={`密钥 ${index + 1}`}
                        className="flex-1 ui-input"
                      />
                      <button
                        onClick={() => {
                          const newKeys = (settings.apiKeys || []).filter((_, i) => i !== index);
                          setSettings({...settings, apiKeys: newKeys});
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
                <button
                  onClick={() => setSettings({...settings, apiKeys: [...(settings.apiKeys || []), '']})}
                  className="ui-btn-secondary w-full"
                >
                  + 添加密钥
                </button>
                <p className="text-xs text-[var(--ui-muted)]">
                  已添加 {settings.apiKeys?.length || 0} 个密钥，系统会自动轮询使用。当某个密钥过期时会自动切换到下一个。
                </p>
              </div>
            ) : (
              // 其他提供商：单密钥输入
              <>
                <input 
                  type="password" 
                  value={settings.apiKey}
                  onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                  placeholder={settings.provider === 'gemini' ? "留空则使用系统默认 Key" : "sk-..."}
                  className="w-full ui-input"
                />
                {settings.provider === 'gemini' && !settings.apiKey && (
                  <p className="text-xs text-[var(--ui-muted)] mt-1">当前正在使用 AI Studio 平台自动注入的安全密钥。</p>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-stone-700">模型名称</label>
              {settings.provider !== 'gemini' && (
                <button
                  onClick={handleDetectModels}
                  disabled={isGenerating}
                  className="ui-btn-ghost text-xs disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  检测可用模型
                </button>
              )}
            </div>
            {settings.availableModels && settings.availableModels.length > 0 ? (
              <select
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                className="w-full ui-input"
              >
                {settings.availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                    {model.contextLength && ` (${model.contextLength})`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={settings.model || ''}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
                className="w-full ui-input"
              />
            )}
            {settings.availableModels && settings.availableModels.length > 0 && (
              <p className="text-xs text-[var(--ui-muted)] mt-1">检测到 {settings.availableModels.length} 个可用模型</p>
            )}
          </div>
        </div>
      </div>

      {mode === 'novel' && (
        <div className="ui-card p-6">
          <h2 className="text-xl font-semibold text-[var(--ui-ink)] mb-6">生成偏好 (长篇小说)</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">每章最低字数</label>
              <input 
                type="number" 
                value={settings.minWordCount || 2000}
                onChange={(e) => setSettings({...settings, minWordCount: parseInt(e.target.value) || 2000})}
                min={500}
                step={500}
                className="w-full ui-input"
              />
              <p className="text-xs text-[var(--ui-muted)] mt-1">AI 会尽量满足此字数要求，建议设置在 1000 - 3000 之间。</p>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-stone-700">创作自由度 (Temperature)</label>
                <span className="text-sm font-semibold text-[var(--ui-accent-text)]">{(settings.temperature ?? 0.9).toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                value={settings.temperature ?? 0.9}
                onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
                min={0}
                max={2}
                step={0.1}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[var(--ui-accent)]"
              />
              <div className="flex justify-between text-xs text-[var(--ui-muted)] mt-1">
                <span>0.0 (保守)</span>
                <span>1.0 (平衡)</span>
                <span>2.0 (激进)</span>
              </div>
              <p className="text-xs text-[var(--ui-muted)] mt-2">
                <span className="font-medium">说明：</span>
                {(settings.temperature ?? 0.9) < 0.5 && '保守模式，内容更规范但可能缺乏创意'}
                {(settings.temperature ?? 0.9) >= 0.5 && (settings.temperature ?? 0.9) < 1.2 && '平衡模式，适合大多数创作场景'}
                {(settings.temperature ?? 0.9) >= 1.2 && '激进模式，内容更自由大胆，可能包含成人内容'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="ui-card p-5">
        <div className="text-center">
          <h2 className="text-sm font-semibold text-[var(--ui-ink)]">赞助支持</h2>
          <p className="text-xs text-[var(--ui-muted)] mt-1">你的支持是小羊老师继续维护的动力</p>
        </div>
        <div className="flex gap-4 justify-center mt-4">
          <div className="flex flex-col items-center gap-2 p-2.5 rounded-xl border border-white/70 bg-white/45">
            <img src="/微信.png" alt="微信支付" className="w-28 h-28 rounded-lg" />
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">微信</span>
          </div>
          <div className="flex flex-col items-center gap-2 p-2.5 rounded-xl border border-white/70 bg-white/45">
            <img src="/支付宝.png" alt="支付宝支付" className="w-28 h-28 rounded-lg" />
            <span className="text-[11px] font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">支付宝</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBookInfo = () => {
    if (mode === 'shortStory') {
      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">短篇故事设定</h2>
          </div>

          <div className="ui-card p-6 md:p-8 space-y-6">
            <ThemeSelector 
              type="shortStory"
              selectedThemes={shortStoryInfo.themes} 
              onChange={(themes) => setShortStoryInfo({...shortStoryInfo, themes})} 
            />
            
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] gap-5 items-start">
              <div className="space-y-2 min-w-0">
                <label className="block text-sm font-medium text-stone-700 leading-5 h-5">故事标题</label>
                <div className="flex gap-2 items-center min-h-11">
                  <input 
                    type="text" 
                    value={shortStoryInfo.title}
                    onChange={(e) => setShortStoryInfo({...shortStoryInfo, title: e.target.value})}
                    placeholder="请输入标题，或点右侧 AI 构思"
                    className="flex-1 min-w-0 ui-input h-11"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateShortStoryTitles}
                    disabled={isGenerating || !shortStoryInfo.themes || shortStoryInfo.themes.length === 0}
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
                        onClick={() => setShortStoryInfo({...shortStoryInfo, title: t})}
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
                      setShortStoryInfo({
                        ...shortStoryInfo,
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
                  disabled={isGenerating || !shortStoryInfo.title}
                  className="ui-btn-ghost text-xs disabled:opacity-50 h-9 px-3"
                >
                  {isGenerating && shortStoryInfo.title && !shortStoryInfo.outline ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI 生成大纲
                </button>
              </div>
              <textarea 
                value={shortStoryInfo.outline}
                onChange={(e) => setShortStoryInfo({...shortStoryInfo, outline: e.target.value})}
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
            disabled={isGenerating || !bookInfo.isTitleSelected}
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
                  disabled={isGenerating || !bookInfo.themes || bookInfo.themes.length === 0}
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
  };

  const renderCharacters = () => (
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
            disabled={isGenerating || !bookInfo.title}
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

  const renderRealms = () => {
    if (mode === 'shortStory') return null;
    const protagonist = characters.find(c => c.role === '主角');
    const protagName = protagonist?.name || '主角';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">{getRealmSystemLabel(bookInfo.themes).title}</h2>
          <button
            onClick={handleGenerateRealms}
            disabled={isGenerating || !bookInfo.title || !characters || characters.length === 0}
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
  };

  const renderTOC = () => {
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
              disabled={isGenerating || !characters || characters.length === 0 || isComplete}
              className="ui-btn-secondary disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              生成单章
            </button>
            <button
              onClick={handleGenerateTOC}
              disabled={isGenerating || !characters || characters.length === 0 || isComplete}
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
                {chapters[item.chapterNumber] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="已有正文" />
                )}
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
                        disabled={isGenerating}
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
                    disabled={isGenerating}
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
  };

  const renderExamples = () => (
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

  const renderChapters = () => {
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
                  onClick={() => handleGenerateShortStoryContent({})}
                  disabled={isGenerating || (!shortStoryInfo.outline && !(shortStoryInfo.segments?.length))}
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
                    onClick={() => handleGenerateShortStoryContent({ forceFinal: true })}
                    disabled={isGenerating}
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
                          disabled={isGenerating}
                          onClick={() => handleGenerateShortStoryContent({ segmentIndex: idx, rewrite: seg.isGenerated })}
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
                          handleGenerateChapter(item.chapterNumber);
                        }}
                        disabled={isGenerating}
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
                          handleDeleteChapter(item.chapterNumber);
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
                    onClick={isBatchGenerating ? handleStopBatchGenerate : handleBatchGenerateChapters}
                    disabled={isGenerating && !isBatchGenerating}
                    className="ui-btn-secondary disabled:opacity-70"
                  >
                    <Play className="w-4 h-4" />
                    {isBatchGenerating ? '停止批量' : '批量下20章'}
                  </button>
                  {chapters[activeChapterNum] && (
                    <button
                      onClick={() => handleDeleteChapter(activeChapterNum)}
                      className="ui-btn-ghost text-red-600 hover:bg-red-50"
                    >
                      删除本章
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateChapter(activeChapterNum)}
                    disabled={isGenerating}
                    className="ui-btn-primary disabled:opacity-70"
                  >
                    {isGenerating && generatingChapterNum === activeChapterNum ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {chapters[activeChapterNum] ? '重新生成' : '生成本章'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto bg-white/20">
                {chapters[activeChapterNum] ? (
                  chapterReadMode ? (
                    <div className="ui-prose-read py-4">{chapters[activeChapterNum]}</div>
                  ) : (
                    <textarea
                      value={chapters[activeChapterNum]}
                      onChange={(e) => setChapters(prev => ({ ...prev, [activeChapterNum]: e.target.value }))}
                      className="ui-input w-full h-full min-h-[calc(100vh-14rem)] max-w-3xl mx-auto block p-5 resize-y leading-7 bg-white"
                    />
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
  };

  const handleReset = async () => {
    if (showResetConfirm) {
      try {
        await dualClearAll({ keepSettings: false });
      } catch (e) {
        console.warn('dualClearAll failed', e);
        try { window.localStorage.clear(); } catch { /* ignore */ }
      }
      window.location.reload();
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  // 备份所有数据到JSON文件
  const handleExportData = () => {
    const data = {
      _version: 1,
      _exportTime: new Date().toISOString(),
      mode,
      settings,
      bookInfo,
      characters,
      realmProgress,
      toc,
      chapters,
      novelMemory,
      activeChapterNum,
      shortStoryInfo,
      shortStoryTitleOptions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `小说数据备份_${bookInfo.title || '未命名'}_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 从JSON文件恢复数据
  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data._version) {
          alert('无效的备份文件！');
          return;
        }
        if (!confirm(`确认恢复备份？\n备份时间：${data._exportTime || '未知'}\n书名：${data.bookInfo?.title || '未命名'}\n\n此操作将覆盖当前所有数据！`)) return;
        if (data.mode !== undefined) setMode(data.mode);
        if (data.settings) setSettings(data.settings);
        if (data.bookInfo) setBookInfo(data.bookInfo);
        if (data.characters) setCharacters(data.characters);
        if (data.realmProgress) setRealmProgress(data.realmProgress);
        if (data.toc) setToc(data.toc);
        if (data.chapters) setChapters(data.chapters);
        if (data.novelMemory) setNovelMemory(data.novelMemory);
        if (data.activeChapterNum !== undefined) setActiveChapterNum(data.activeChapterNum);
        if (data.shortStoryInfo) setShortStoryInfo(data.shortStoryInfo);
        if (data.shortStoryTitleOptions) setShortStoryTitleOptions(data.shortStoryTitleOptions);
        alert('数据恢复成功！');
      } catch (err) {
        alert('恢复失败：文件格式错误');
      }
    };
    input.click();
  };

  const handleResetBookInfo = async () => {
    if (!confirm('确定要重开新书吗？将清空书籍设定、人物、目录、正文与短篇内容，但保留 API 设置。')) {
      return;
    }
    try {
      await dualClearAll({ keepSettings: true });
    } catch (e) {
      console.warn('dualClearAll keepSettings failed', e);
    }
    const defaultThemes = [MALE_THEME_NAMES[0]];
    setBookInfo({
      title: '',
      themes: defaultThemes,
      lengthType: '100',
      targetChapterCount: 100,
      outline: '',
      worldbuilding: '',
      endingOutline: '',
      titleOptions: [],
      isTitleSelected: false,
      enableRealms: themesRecommendRealms(defaultThemes) === 'recommend'
    });
    setCharacters([]);
    setRealmProgress({ realms: [], protagonistCurrentRealmIndex: 0, protagonistCurrentSubRealmIndex: 0, chapterRealmMap: {} });
    setToc([]);
    setChapters({});
    setNovelMemory(emptyNovelMemory);
    setActiveChapterNum(null);
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
    setActiveTab('settings');
    alert('已重开新书，API 设置保持不变');
  };

  const navItems = mode === 'novel' 
    ? [
        { id: 'settings', icon: SettingsIcon, label: '设置' },
        { id: 'book', icon: BookOpen, label: '书籍信息' },
        { id: 'characters', icon: Users, label: '人物关系' },
        ...(bookInfo.enableRealms !== false ? [{ id: 'realms', icon: Globe, label: getRealmSystemLabel(bookInfo.themes).title }] : []),
        { id: 'toc', icon: List, label: '大纲目录' },
        { id: 'chapters', icon: FileText, label: '章节内容' },
      ]
    : [
        { id: 'settings', icon: SettingsIcon, label: '设置' },
        { id: 'book', icon: Feather, label: '短篇设定' },
        { id: 'chapters', icon: FileText, label: '故事正文' },
      ];

  // 范文参考链接（去重）
  const EXAMPLE_LINKS = [
    { url: 'https://fanqienovel.com/page/7610270375947013144', title: '范文示例 1' },
    { url: 'https://fanqienovel.com/page/7546082508601822233', title: '范文示例 2' },
    { url: 'https://fanqienovel.com/page/7614757506149010457', title: '范文示例 3' },
    { url: 'https://fanqienovel.com/page/7612519494467996697', title: '范文示例 4' },
    { url: 'https://fanqienovel.com/page/7603258880004475928', title: '范文示例 5' },
  ];

  return (
    <div className="flex h-screen text-[var(--ui-ink)] font-sans overflow-hidden bg-transparent">
      {/* Main Sidebar - glass, full height, tools expanded */}
      <aside className="ui-sidebar-panel w-[4.75rem] md:w-64 lg:w-72 flex flex-col h-full shrink-0">
        <div className="h-14 flex items-center justify-center md:justify-start md:px-4 border-b border-[var(--ui-line)] shrink-0">
          <div className="ui-logo-mark">
            <BookOpen className="w-4 h-4 text-white shrink-0" />
          </div>
          <div className="ml-2.5 hidden md:block min-w-0">
            <h1 className="font-semibold text-[15px] tracking-tight text-[var(--ui-ink)] leading-tight">小说家</h1>
            <p className="text-[10px] text-[var(--ui-muted)] leading-tight mt-0.5">绯雾书房 · 写作工作台</p>
          </div>
        </div>

        <div className="p-3 border-b border-[var(--ui-line)] shrink-0">
          <div className="ui-mode-switch">
            <button type="button" onClick={() => { setMode('novel'); setActiveTab('book'); }} className={mode === 'novel' ? 'ui-mode-active' : 'ui-mode-idle'}>长篇</button>
            <button type="button" onClick={() => { setMode('shortStory'); setActiveTab('book'); }} className={mode === 'shortStory' ? 'ui-mode-active' : 'ui-mode-idle'}>短篇</button>
          </div>
        </div>

        {mode === 'novel' && (
          <div className="ui-progress-card hidden md:block">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-[var(--ui-ink)]">创作进度</span>
              <span className="text-[11px] tabular-nums text-[var(--ui-accent-text)]">
                {[!!bookInfo.title, characters.length > 0, toc.length > 0, Object.keys(chapters).length > 0].filter(Boolean).length}/4
              </span>
            </div>
            <div className="ui-progress-track">
              <div className="ui-progress-fill" style={{ width: `${([!!bookInfo.title, characters.length > 0, toc.length > 0, Object.keys(chapters).length > 0].filter(Boolean).length / 4) * 100}%` }} />
            </div>
            <p className="text-[10px] leading-relaxed text-[var(--ui-muted)] mt-2">
              {!bookInfo.title ? '下一步：选择题材并构思书名' : characters.length === 0 ? '下一步：生成人物关系' : toc.length === 0 ? '下一步：生成大纲目录' : Object.keys(chapters).length === 0 ? '下一步：开始撰写第一章' : '作品正在持续生长'}
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          <div className="px-3 pt-3 pb-1 hidden md:block shrink-0">
            <p className="ui-side-label">写作流程</p>
          </div>
          <nav className="px-2.5 pb-2 space-y-1.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as Tab)}
                className={`ui-side-btn ${activeTab === item.id ? 'ui-nav-active' : 'ui-nav-idle'}`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="ml-2.5 hidden md:block text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-auto px-2.5 pb-3 pt-2 border-t border-[var(--ui-line)] space-y-1.5">
            <div className="px-1 pb-1 hidden md:block">
              <p className="ui-side-label">工具</p>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                disabled={(mode === 'novel' && Object.keys(chapters).length === 0) || (mode === 'shortStory' && !shortStoryInfo.content)}
                className="ui-side-btn ui-side-btn-solid disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="ml-2.5 hidden md:block">导出全书</span>
              </button>
              {showDownloadMenu && (
                <div className="ui-menu bottom-full mb-2 left-0 right-0 md:left-0 md:right-auto md:w-full">
                  <button type="button" onClick={() => { handleDownload('txt'); setShowDownloadMenu(false); }} className="ui-menu-item">导出为 TXT</button>
                  <button type="button" onClick={() => { handleDownload('docx'); setShowDownloadMenu(false); }} className="ui-menu-item">导出为 Word</button>
                </div>
              )}
            </div>

            <button type="button" onClick={() => setActiveTab('examples')} className={`ui-side-btn ${activeTab === 'examples' ? 'ui-nav-active' : 'ui-side-btn-tool'}`}>
              <FileText className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">范文参考</span>
            </button>

            <a href="https://github.com/sqdft" target="_blank" rel="noopener noreferrer" className="ui-side-btn ui-side-btn-tool no-underline">
              <Globe className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">我的博客</span>
            </a>

            <button type="button" onClick={handleExportData} className="ui-side-btn ui-side-btn-tool">
              <Download className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">备份数据</span>
            </button>

            <button type="button" onClick={handleImportData} className="ui-side-btn ui-side-btn-tool">
              <Upload className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">恢复数据</span>
            </button>

            <button type="button" onClick={handleResetBookInfo} className="ui-side-btn ui-side-btn-warn">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="ml-2.5 hidden md:block text-sm">重开新书</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className={`ui-side-btn ${showResetConfirm ? 'ui-side-btn-danger-active' : 'ui-side-btn-danger'}`}
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${showResetConfirm ? 'animate-spin' : ''}`} />
              <span className="ml-2.5 hidden md:block text-sm">{showResetConfirm ? '再点确认重置' : '重置全部'}</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="ui-main-panel flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <header className="ui-header">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--ui-ink)] text-[15px] truncate">
              {activeTab === 'settings' && '系统设置'}
              {activeTab === 'book' && (mode === 'novel' ? '书籍信息' : '短篇设定')}
              {activeTab === 'characters' && '人物关系'}
              {activeTab === 'realms' && getRealmSystemLabel(bookInfo.themes).title}
              {activeTab === 'toc' && '大纲目录'}
              {activeTab === 'chapters' && (mode === 'novel' ? '章节正文' : '故事正文')}
              {activeTab === 'examples' && '范文参考'}
            </h2>
          </div>
          <div className="flex-1 min-w-0" />
          {(bookInfo.title || shortStoryInfo.title) && (
            <span className="hidden sm:inline text-sm text-[var(--ui-muted)] truncate max-w-[14rem]">
              {mode === 'novel' ? bookInfo.title : shortStoryInfo.title}
            </span>
          )}
          {mode === 'novel' && bookInfo.targetChapterCount > 0 && (
            <span className="text-xs tabular-nums shrink-0 font-semibold text-[var(--ui-accent-text)] bg-[var(--ui-accent-soft)] px-2.5 py-1 rounded-full border border-[rgba(196,81,31,0.2)]">
              {Object.keys(chapters).length}/{bookInfo.targetChapterCount} 章
            </span>
          )}
          {isGenerating && (
            <span className="ui-status-pill shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              生成中
            </span>
          )}
        </header>

        <main className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'chapters' ? 'p-0' : 'p-5 md:p-8'}`}>
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'book' && renderBookInfo()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'realms' && renderRealms()}
          {activeTab === 'toc' && renderTOC()}
          {activeTab === 'chapters' && renderChapters()}
          {activeTab === 'examples' && renderExamples()}
        </main>
      </div>
    </div>
  );
}
