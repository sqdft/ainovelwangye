import { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Settings as SettingsIcon,
  Users,
  List,
  FileText,
  Download,
  Loader2,
  Wand2,
  Play,
  Feather,
  RefreshCw,
  Globe,
  Upload,
  MoreHorizontal,
  ChevronDown,
  Eye,
  Pencil,
  LayoutList,
  Rows3,
  Search
} from 'lucide-react';
import { Settings, BookInfo, Character, TOCItem, Provider, ShortStoryInfo, Realm, SubRealm, RealmProgress, ModelInfo, NovelMemory, ProviderProfile } from './types';
import { dualGet, dualSet, dualClearAll } from './lib/storage';
import { useTaskRunner, settingsReady } from './orchestration';
import { SettingsPanel } from './features/settings';
import { ChaptersPanel } from './features/chapters';
import { BookPanel } from './features/book';
import { CharactersPanel } from './features/characters';
import { RealmsPanel } from './features/realms';
import { TocPanel } from './features/toc';
import { ExamplesPanel } from './features/examples';
import { DownstreamConfirmModal, type DownstreamConfirmState } from './components/DownstreamConfirmModal';
import { MemoryPanel } from './features/memory';
import type { DownstreamLevel } from './orchestration';

import { AppHeader, AppSidebar, ToastStack, type ToastItem as LayoutToastItem } from './components/layout';
import { normalizeBaseUrl, proxyFetch } from './lib/devProxy';
import { generateBookInfo, generateCharacters, generateRealms, generateTOC, generateChapterContent, generateShortStoryContent, generateShortStoryTitles, generateShortStoryOutlineFromTitle, generateShortStorySegments, generateBookTitles, updateNovelMemory, type ChapterGenOptions } from './services/aiService';
import { PROVIDERS, getProviderConfig } from './config/providers';
import { MALE_THEME_NAMES, FEMALE_THEME_NAMES, SHORT_STORY_THEME_NAMES } from './config/themes';
import { saveAs } from 'file-saver';

type Tab = 'settings' | 'book' | 'characters' | 'realms' | 'toc' | 'chapters' | 'examples' | 'memory';
type Mode = 'novel' | 'shortStory';

type ToastKind = 'info' | 'success' | 'error' | 'warn';
type ToastItem = { id: number; kind: ToastKind; message: string; actionLabel?: string; actionTab?: Tab };



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


export default function App() {
  const [mode, setMode] = useDualStorage<Mode>('ai_novel_mode', 'novel');
  const [activeTab, setActiveTab] = useDualStorage<Tab>('ai_novel_activeTab', 'settings');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [batchFailedChapters, setBatchFailedChapters] = useState<number[]>([]);
  const [chapterQualityNotes, setChapterQualityNotes] = useState<Record<number, string[]>>({});
  const [downstreamConfirm, setDownstreamConfirm] = useState<DownstreamConfirmState>(null);
  const [memoryEditable, setMemoryEditable] = useState(false);
  const toastIdRef = useRef(0);
  const [providerProfiles, setProviderProfiles] = useDualStorage<ProviderProfile[]>('ai_novel_provider_profiles', []);
  const [activeProfileId, setActiveProfileId] = useDualStorage<string | null>('ai_novel_active_profile_id', null);
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const [tocCompact, setTocCompact] = useState(true);
  const [tocMenuOpen, setTocMenuOpen] = useState<number | null>(null);
  const [chapterReadMode, setChapterReadMode] = useState(true);
  const [showShortResetMenu, setShowShortResetMenu] = useState(false);

  const pushToast = (
    message: string,
    kind: ToastKind = 'info',
    action?: { label: string; tab: Tab }
  ) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [
      ...prev.slice(-4),
      {
        id,
        kind,
        message,
        actionLabel: action?.label,
        actionTab: action?.tab,
      },
    ]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, kind === 'error' ? 8000 : 4500);
  };

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const {
    taskState,
    setTaskState,
    patchTaskProgress,
    isGenerating,
    setIsGenerating,
    isBatchGenerating,
    setIsBatchGenerating,
    generatingChapterNum,
    setGeneratingChapterNum,
    isTaskBusy,
    cancelTaskRef,
    abortControllerRef,
    stopBatchRef,
    runTask,
    retryLastTask,
    requestCancelTask,
    clearTask,
  } = useTaskRunner(pushToast);
  const ensureSettingsReady = () => {
    const r = settingsReady(settings);
    if (r.ok) return true;
    pushToast(r.reason || '请先完善 API 设置', 'warn', { label: '去设置', tab: 'settings' });
    setActiveTab('settings');
    return false;
  };


  const settingsFromProfile = (p: ProviderProfile): Settings => ({
    ...settings,
    provider: p.provider,
    apiKey: p.apiKey,
    apiKeys: p.apiKeys || [],
    currentKeyIndex: p.currentKeyIndex || 0,
    baseUrl: p.baseUrl,
    model: p.model,
    availableModels: p.availableModels || [],
  });

  const profileFromSettings = (name: string, id?: string): ProviderProfile => ({
    id: id || `prof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || `${PROVIDERS[settings.provider]?.label || settings.provider} · ${settings.model || '默认模型'}`,
    provider: settings.provider,
    apiKey: settings.apiKey || '',
    apiKeys: settings.apiKeys || [],
    currentKeyIndex: settings.currentKeyIndex || 0,
    baseUrl: settings.baseUrl || '',
    model: settings.model || '',
    availableModels: settings.availableModels || [],
    updatedAt: Date.now(),
  });

  const activateProviderProfile = (p: ProviderProfile) => {
    setActiveProfileId(p.id);
    setEditingProfileId(p.id);
    setProfileNameDraft(p.name);
    setSettings(settingsFromProfile(p));
    pushToast(`已切换：${p.name}`, 'success');
  };

  const saveProviderProfile = (asNew = false) => {
    const name = profileNameDraft.trim() || `${PROVIDERS[settings.provider]?.label || '供应商'} · ${settings.model || '模型'}`;
    if (!asNew && activeProfileId) {
      const exists = providerProfiles.some(p => p.id === activeProfileId);
      if (exists) {
        setProviderProfiles(providerProfiles.map(p =>
          p.id === activeProfileId ? profileFromSettings(name, activeProfileId) : p
        ));
      } else {
        const created = profileFromSettings(name);
        setProviderProfiles([...providerProfiles, created]);
        setActiveProfileId(created.id);
        setEditingProfileId(created.id);
      }
      setProfileNameDraft(name);
      pushToast('供应商卡片已更新', 'success');
      return;
    }
    const created = profileFromSettings(name);
    setProviderProfiles([...providerProfiles, created]);
    setActiveProfileId(created.id);
    setEditingProfileId(created.id);
    setProfileNameDraft(created.name);
    pushToast('已保存新供应商卡片', 'success');
  };

  const deleteProviderProfile = (id: string) => {
    const next = providerProfiles.filter(p => p.id !== id);
    setProviderProfiles(next);
    if (activeProfileId === id) {
      setActiveProfileId(next[0]?.id || null);
      if (next[0]) {
        setSettings(settingsFromProfile(next[0]));
        setProfileNameDraft(next[0].name);
        setEditingProfileId(next[0].id);
      } else {
        setEditingProfileId(null);
        setProfileNameDraft('');
      }
    }
    pushToast('已删除卡片', 'info');
  };

  /** 添加新供应商：不清空已保存卡片，只进入「空白草稿」编辑态 */
  const beginNewProviderProfile = () => {
    setActiveProfileId(null);
    setEditingProfileId(null);
    setProfileNameDraft('');
    // 表单给干净默认值，不覆盖已保存的其它卡片
    const custom = PROVIDERS['custom'] || PROVIDERS['openai'] || Object.values(PROVIDERS)[0];
    setSettings(prev => ({
      ...prev,
      provider: 'custom',
      apiKey: '',
      apiKeys: [],
      currentKeyIndex: 0,
      baseUrl: custom?.baseUrl || 'https://api.openai.com/v1',
      model: custom?.model || '',
      availableModels: [],
      // 保留 minWordCount / temperature 等写作偏好
      minWordCount: prev.minWordCount,
      temperature: prev.temperature,
    }));
    pushToast('已进入新建供应商：填好后点「保存为新卡片」', 'info');
  };


  const requireGate = (
    ok: boolean,
    message: string,
    tab: Tab,
    actionLabel = '去处理'
  ): boolean => {
    if (ok) return true;
    pushToast(message, 'warn', { label: actionLabel, tab });
    setActiveTab(tab);
    return false;
  };

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

  const novelProgress = (() => {
    const hasTitle = !!bookInfo.title && !!bookInfo.isTitleSelected;
    const hasChars = characters.length > 0;
    const hasToc = toc.length > 0;
    const written = Object.keys(chapters).length;
    const target = Math.max(bookInfo.targetChapterCount || 1, 1);
    const chapterRatio = Math.min(written / target, 1);
    const score = (hasTitle ? 0.25 : 0) + (hasChars ? 0.25 : 0) + (hasToc ? 0.25 : 0) + 0.25 * chapterRatio;
    const doneSteps = [hasTitle, hasChars, hasToc, written > 0].filter(Boolean).length;
    let nextHint = '下一步：选择题材并构思书名';
    if (!hasTitle) nextHint = '下一步：选择题材并构思书名';
    else if (!bookInfo.outline) nextHint = '下一步：生成或填写故事大纲';
    else if (!hasChars) nextHint = '下一步：生成人物关系';
    else if (!hasToc) nextHint = '下一步：生成大纲目录';
    else if (written === 0) nextHint = '下一步：开始写第一章正文';
    else if (written < toc.length) nextHint = `下一步：继续写正文（已写 ${written}/${toc.length} 章目录）`;
    else if (toc.length < target) nextHint = `下一步：补充目录（目录 ${toc.length}/${target}）`;
    else nextHint = '可导出全书，或精修章节';
    return { score, doneSteps, nextHint, written, target, tocCount: toc.length };
  })();

  const shortProgress = (() => {
    const hasTheme = (shortStoryInfo.themes || []).length > 0;
    const hasTitle = !!shortStoryInfo.title;
    const hasOutline = !!(shortStoryInfo.outline || '').trim();
    const segs = shortStoryInfo.segments || [];
    const hasSegs = segs.length > 0;
    const doneSegs = segs.filter(s => s.isGenerated).length;
    const words = (shortStoryInfo.content || '').replace(/\s/g, '').length;
    const target = Math.max(shortStoryInfo.targetWordCount || 10000, 1);
    const wordRatio = Math.min(words / target, 1);
    const score =
      (hasTheme ? 0.15 : 0) +
      (hasTitle ? 0.2 : 0) +
      (hasOutline || hasSegs ? 0.25 : 0) +
      0.4 * (hasSegs ? doneSegs / Math.max(segs.length, 1) : wordRatio);
    const doneSteps = [
      hasTheme && hasTitle,
      hasOutline || hasSegs,
      words > 0,
      wordRatio >= 0.9 || (hasSegs && doneSegs >= segs.length),
    ].filter(Boolean).length;
    let nextHint = '下一步：选择题材并填写标题';
    if (!hasTitle) nextHint = '下一步：选择题材并填写标题';
    else if (!hasOutline && !hasSegs) nextHint = '下一步：填写脑洞大纲或生成分段规划';
    else if (hasSegs && doneSegs < segs.length) nextHint = `下一步：写第 ${doneSegs + 1}/${segs.length} 段`;
    else if (words < target * 0.9) nextHint = `下一步：继续写正文（约 ${words}/${target} 字）`;
    else nextHint = '可收束结局并导出';
    return { score, doneSteps, nextHint, words, target, doneSegs, segTotal: segs.length };
  })();



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
      pushToast('Gemini 不支持模型检测，请手动输入模型名称', 'info');
      return;
    }

    if (!settings.baseUrl) {
      pushToast('请先设置 Base URL', 'warn');
      return;
    }

    const apiKey = settings.provider === 'free' && settings.apiKeys && settings.apiKeys.length > 0
      ? settings.apiKeys[settings.currentKeyIndex || 0] || settings.apiKeys[0]
      : settings.apiKey;

    if (!apiKey && settings.provider !== 'kilo') {
      pushToast('请先设置 API Key', 'warn');
      return;
    }

    await runTask({
      kind: 'models',
      label: '检测可用模型',
      cancellable: false,
      run: async () => {
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
        // 同步到当前卡片
        if (activeProfileId) {
          setProviderProfiles(prev => prev.map(p =>
            p.id === activeProfileId
              ? { ...p, availableModels: models, model: settings.model || p.model, updatedAt: Date.now() }
              : p
          ));
        }
        pushToast(`检测成功！共发现 ${models.length} 个可用模型`, 'success');
      },
    });
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

  const requestClearDownstream = (
    title: string,
    preferredLevel: DownstreamLevel,
    apply: () => void,
    detail?: string
  ) => {
    if (!hasNovelDownstreamData()) {
      apply();
      return;
    }
    setDownstreamConfirm({ title, detail, preferredLevel, apply });
  };

  const resolveDownstreamConfirm = (level: DownstreamLevel) => {
    if (!downstreamConfirm) return;
    const { apply } = downstreamConfirm;
    setDownstreamConfirm(null);
    clearNovelDownstream(level);
    apply();
  };

  const handleLengthChange = (lengthType: string) => {
    requestClearDownstream(
      '修改篇幅会影响后续生成内容，请选择要清空的范围。',
      'toc',
      () => {
        const count = LENGTHS.find(l => l.value === lengthType)?.count || 100;
        setBookInfo({ ...bookInfo, lengthType, targetChapterCount: count });
      },
      '建议至少清空目录与正文，以免篇幅与目录不一致。'
    );
  };

  const handleBookThemesChange = (themes: string[]) => {
    requestClearDownstream(
      '修改主题会影响书籍设定与下游内容，请选择清理范围。',
      'book',
      () => {
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
      }
    );
  };

  const handleBookTitleInput = (title: string) => {
    if (title === bookInfo.title) {
      setBookInfo({ ...bookInfo, title, isTitleSelected: !!title });
      return;
    }
    requestClearDownstream(
      '修改书名会影响人物、目录和正文，请选择清理范围。',
      'book',
      () => setBookInfo({ ...bookInfo, title, isTitleSelected: !!title })
    );
  };

  const handleBookPlanningFieldChange = (field: 'outline' | 'worldbuilding', value: string) => {
    if (value === bookInfo[field]) {
      setBookInfo({ ...bookInfo, [field]: value });
      return;
    }
    requestClearDownstream(
      '修改大纲或世界观会影响人物、目录和正文，请选择清理范围。',
      'book',
      () => setBookInfo({ ...bookInfo, [field]: value }),
      '若只想重写正文，可选「仅正文」。'
    );
  };

  // 生成书名选项（新增）
  const handleGenerateBookTitles = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.themes?.length, '请先选择至少一个主题', 'book', '去选题材')) return;
    await runTask({
      kind: 'titles',
      label: '生成书名候选',
      run: async () => {
        const titles = await generateBookTitles(bookInfo.themes, bookInfo.lengthType, settings, bookInfo.targetChapterCount);
        setBookInfo({ ...bookInfo, titleOptions: titles, isTitleSelected: false, title: '' });
        pushToast(`已生成 ${titles.length} 个书名，请点选一个`, 'success');
      },
    });
  };

  // 选择书名（新增）
  const handleSelectBookTitle = (title: string) => {
    if (title === bookInfo.title) {
      setBookInfo({ ...bookInfo, title, isTitleSelected: true, titleOptions: [] });
      return;
    }
    requestClearDownstream(
      '切换书名会影响人物、目录和正文，请选择清理范围。',
      'book',
      () => setBookInfo({ ...bookInfo, title, isTitleSelected: true, titleOptions: [] }),
      '避免新旧设定混用；若只重写正文可选「仅正文」。'
    );
  };

  const handleGenerateBookInfo = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.isTitleSelected && !!bookInfo.title, '请先生成并选择一个书名', 'book', '去选书名')) return;
    await runTask({
      kind: 'bookInfo',
      label: '生成大纲与世界观',
      run: async () => {
        const info = await generateBookInfo(bookInfo, settings);
        clearNovelDownstream('book');
        setBookInfo({ ...bookInfo, ...info });
        setActiveTab('book');
        pushToast('大纲与世界观已生成', 'success', { label: '去生成人物', tab: 'characters' });
      },
    });
  };

  const handleGenerateCharacters = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.title && !!bookInfo.outline, '请先生成或填写书籍信息（书名+大纲）', 'book', '去书籍信息')) return;
    await runTask({
      kind: 'characters',
      label: '生成人物关系',
      run: async () => {
        const chars = await generateCharacters(bookInfo, settings);
        clearNovelDownstream('toc');
        setCharacters(chars);
        setActiveTab('characters');
        pushToast(`已生成 ${chars.length} 位人物`, 'success', { label: '去大纲目录', tab: 'toc' });
      },
    });
  };

  // 生成境界体系
  const handleGenerateRealms = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.title, '请先完成书籍信息', 'book', '去书籍信息')) return;
    if (!requireGate(characters.length > 0, '请先生成人物关系', 'characters', '去人物')) return;
    await runTask({
      kind: 'realms',
      label: '生成规则/境界体系',
      run: async () => {
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
          },
    });
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
      pushToast('至少保留一个角色', 'warn');
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


  /** 按章号合并目录：永不因新批覆盖/丢掉已有合理章；同号以旧为准（可改为新） */
  const mergeTocItems = (prev: TOCItem[], incoming: TOCItem[], preferIncoming = false): TOCItem[] => {
    const map = new Map<number, TOCItem>();
    prev.forEach(item => map.set(item.chapterNumber, item));
    incoming.forEach(item => {
      if (!map.has(item.chapterNumber) || preferIncoming) {
        map.set(item.chapterNumber, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  };

  /** 下一个应生成的起点：优先补空洞，否则 max+1 */
  const nextTocStartIndex = () => {
    if (toc.length === 0) return 1;
    const nums = new Set(toc.map(t => t.chapterNumber));
    const max = Math.max(...nums);
    for (let n = 1; n <= max; n++) {
      if (!nums.has(n)) return n;
    }
    return max + 1;
  };

  const handleGenerateTOC = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.title, '请先完成书籍信息', 'book', '去书籍信息')) return;
    if (!requireGate(characters.length > 0, '请先生成人物关系', 'characters', '去人物')) return;
    
    const startIndex = nextTocStartIndex();
    if (startIndex > bookInfo.targetChapterCount) {
      pushToast('已生成全部目录！', 'success');
      return;
    }

    await runTask({
      kind: 'toc',
      label: toc.some(t => t.chapterNumber >= startIndex) ? '补缺/续写大纲目录' : '生成大纲目录',
      run: async () => {
      const batchSize = 30;
      // 以「当前已有全部目录」为底座，失败也不会丢掉底座
      const baseToc = [...toc];
      const existingTitles = baseToc.map(item => item.title);
      const existingSummaries = baseToc.map(item => item.summary);
      let newChapters: TOCItem[] = [];
      try {
        newChapters = await generateTOC(bookInfo, characters, settings, startIndex, batchSize, existingTitles, existingSummaries);
      } catch (e: any) {
        // 彻底失败：底座仍在，只提示
        pushToast(
          `本批请求失败：${e?.message || e}。已有 ${baseToc.length} 章目录全部保留，可直接再点生成接着补。`,
          'error'
        );
        setActiveTab('toc');
        return;
      }
      const notes = ((newChapters as any).__sanitizedNotes || []) as string[];
      const partial = ((newChapters as any).__partial || '') as string;
      const similar = findSimilarSummaries(newChapters, baseToc);
      // 合并入库：旧章优先保留，新章只补缺号
      const merged = mergeTocItems(baseToc, newChapters, false);
      setToc(merged);
      setActiveTab('toc');
      if (notes.length > 0) {
        pushToast(
          `有 ${notes.length} 个过早「结局感」标题已自动改中性名，目录已保留。\n${notes.slice(0, 3).join('\n')}${notes.length > 3 ? '\n…' : ''}`,
          'warn'
        );
      }
      if (partial) {
        pushToast(partial + '。不会清空已有目录，继续点生成即可补缺。', 'warn');
      } else if (similar.length > 0) {
        pushToast(
          `本批目录已生成，但发现剧情摘要疑似重复：\n${similar.slice(0, 5).join('\n')}${similar.length > 5 ? '\n…共 ' + similar.length + ' 条' : ''}\n\n可在大纲目录中手动改写摘要后继续。`,
          'success'
        );
      } else if (newChapters.length > 0) {
        pushToast(`本批已加入 ${newChapters.length} 章目录`, 'success');
      }
          },
    });
  };

  // 只生成单章目录（接在末尾）
  const handleGenerateSingleChapterOutline = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!bookInfo.title, '请先完成书籍信息', 'book', '去书籍信息')) return;
    if (!requireGate(characters.length > 0, '请先生成人物关系', 'characters', '去人物')) return;
    
    const nextChapterNum = nextTocStartIndex();
    if (nextChapterNum > bookInfo.targetChapterCount) {
      pushToast('已生成全部目录！', 'success');
      return;
    }

    await runTask({
      kind: 'toc',
      label: '生成单章目录',
      run: async () => {
      const existingTitles = toc.map(item => item.title);
      // 只生成1章
      const newChapters = await generateTOC(bookInfo, characters, settings, nextChapterNum, 1, existingTitles, toc.map(item => item.summary));
      if (newChapters.length > 0) {
        setToc(mergeTocItems(toc, newChapters, true));
        const notes = ((newChapters as any).__sanitizedNotes || []) as string[];
        pushToast(
          notes.length
            ? `第${nextChapterNum}章目录已生成（标题已自动避开结局感）`
            : `第${nextChapterNum}章目录生成成功！`,
          notes.length ? 'warn' : 'success'
        );
      } else {
        pushToast('本单章未通过校验（摘要撞车或空返回），请再试一次；已有目录不受影响。', 'warn');
      }
          },
    });
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
    if (!requireGate(!!bookInfo.title, '请先完成书籍信息', 'book', '去书籍信息')) return;
    if (!requireGate(characters.length > 0, '请先生成人物关系', 'characters', '去人物')) return;

    await runTask({
      kind: 'toc',
      label: '重生成章纲',
      run: async () => {
      // 获取其他章节的标题（不包括当前要重新生成的）
      const existingTitles = toc
        .filter(item => item.chapterNumber !== chapterNum)
        .map(item => item.title);
      
      // 生成新标题
      const newChapters = await generateTOC(bookInfo, characters, settings, chapterNum, 1, existingTitles, toc.map(item => item.summary));
      if (newChapters.length > 0) {
        // 替换原目录项（仅替换该章，其它章原样保留）
        const updatedTOC = toc.map(item =>
          item.chapterNumber === chapterNum ? newChapters[0] : item
        );
        setToc(updatedTOC);
        
        // 清空该章内容（因为大纲变了）
        const updatedChapters = { ...chapters };
        delete updatedChapters[chapterNum];
        setChapters(updatedChapters);
        
        pushToast(`第${chapterNum}章目录已重新生成！`, 'info');
      }
          },
    });
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

  const generateChapterWithQualityGate = async (
    tocItem: TOCItem,
    currentChapters: Record<number, string>,
    memory: NovelMemory = novelMemory,
    genOpts?: ChapterGenOptions
  ) => {
    const previousContents: string[] = [];
    for (let i = 1; i < tocItem.chapterNumber; i++) {
      if (currentChapters[i]) previousContents.push(currentChapters[i]);
    }
    const previousContent = previousContents[previousContents.length - 1];
    const activeRealmProgress = bookInfo.enableRealms !== false ? realmProgress : undefined;
    const signal = genOpts?.signal || abortControllerRef.current?.signal;
    const content = await generateChapterContent(
      bookInfo,
      characters,
      tocItem,
      previousContents,
      settings,
      toc,
      activeRealmProgress,
      memory,
      { ...genOpts, signal }
    );
    if (!content.trim()) {
      throw new Error('AI 返回的章节正文为空，请重试。');
    }
    if (signal?.aborted || cancelTaskRef.current) {
      throw new Error('已取消');
    }
    const warnings = validateChapterContent(content, tocItem, previousContent);
    if (warnings.length > 0) {
      setChapterQualityNotes(prev => ({ ...prev, [tocItem.chapterNumber]: warnings }));
      if (!isBatchGenerating) {
        pushToast(`第${tocItem.chapterNumber}章有 ${warnings.length} 条质量提醒`, 'warn');
      }
    } else {
      setChapterQualityNotes(prev => {
        const next = { ...prev };
        delete next[tocItem.chapterNumber];
        return next;
      });
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

  const handleGenerateChapter = async (
    chapterNum: number,
    opts?: { mode?: ChapterGenOptions['mode']; directive?: string; stream?: boolean }
  ) => {
    if (!ensureSettingsReady()) return;
    const tocItem = toc.find(t => t.chapterNumber === chapterNum);
    if (!tocItem) return;
    const mode = opts?.mode || 'write';
    const existing = chapters[chapterNum] || '';
    if (mode !== 'write' && !existing.trim()) {
      pushToast('本章尚无正文，请先生成', 'warn');
      return;
    }
    if (mode === 'rewrite' && !(opts?.directive || '').trim()) {
      pushToast('请先填写「本章要改成…」', 'warn');
      return;
    }
    const labelMap: Record<string, string> = {
      write: `生成第 ${chapterNum} 章正文`,
      continue: `续写第 ${chapterNum} 章`,
      expand: `扩写第 ${chapterNum} 章`,
      conclude: `收束第 ${chapterNum} 章`,
      rewrite: `改写第 ${chapterNum} 章`,
    };
    await runTask({
      kind: 'chapter',
      label: labelMap[mode] || labelMap.write,
      cancellable: true,
      run: async () => {
        setGeneratingChapterNum(chapterNum);
        if (cancelTaskRef.current) throw new Error('已取消');
        const useStream = opts?.stream !== false && mode !== 'write' ? true : !!opts?.stream;
        // 单章：有正文的改写类默认流式；首次 write 也可流式
        const stream = opts?.stream !== false;
        const { content } = await generateChapterWithQualityGate(tocItem, chapters, novelMemory, {
          mode,
          directive: opts?.directive,
          existingContent: existing,
          onChunk: stream
            ? (full) => {
                setChapters(prev => ({ ...prev, [chapterNum]: full }));
                setChapterReadMode(false);
              }
            : undefined,
        });
        if (cancelTaskRef.current) throw new Error('已取消');
        setChapters(prev => ({ ...prev, [chapterNum]: content }));
        setActiveChapterNum(chapterNum);
        setActiveTab('chapters');
        setGeneratingChapterNum(null);
        pushToast(labelMap[mode] + '完成', 'success');
      },
    });
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

  const handleStopBatchGenerate = () => {
    requestCancelTask();
  };

  const handleBatchGenerateChapters = async (opts?: { onlyFailed?: boolean; onlyMissing?: boolean; limit?: number }) => {
    if (!ensureSettingsReady()) return;
    const limit = opts?.limit ?? 20;
    let pool = toc.filter(t => !chapters[t.chapterNumber]);
    if (opts?.onlyFailed && batchFailedChapters.length > 0) {
      const failedSet = new Set(batchFailedChapters);
      pool = toc.filter(t => failedSet.has(t.chapterNumber) && !chapters[t.chapterNumber]);
    }
    const toGenerate = pool.slice(0, limit);

    if (toGenerate.length === 0) {
      if (toc.length === 0) {
        requireGate(false, '请先生成大纲目录', 'toc', '去目录');
      } else {
        pushToast('当前目录章节都已生成，请先补充更多目录', 'info', { label: '去目录', tab: 'toc' });
        setActiveTab('toc');
      }
      return;
    }

    await runTask({
      kind: 'batch',
      label: `批量生成正文 0/${toGenerate.length}`,
      cancellable: true,
      progress: { current: 0, total: toGenerate.length },
      run: async () => {
        setIsBatchGenerating(true);
        stopBatchRef.current = false;
        cancelTaskRef.current = false;
        const failed: number[] = [];
        let okCount = 0;
        let currentChapters = { ...chapters };
        let currentMemory = novelMemory;

        for (let i = 0; i < toGenerate.length; i++) {
          if (stopBatchRef.current || cancelTaskRef.current) break;
          const item = toGenerate[i];
          setGeneratingChapterNum(item.chapterNumber);
          setActiveChapterNum(item.chapterNumber);
          patchTaskProgress({
            kind: 'batch',
            label: `批量生成正文 ${i + 1}/${toGenerate.length} · 第${item.chapterNumber}章`,
            progress: { current: i + 1, total: toGenerate.length },
            cancellable: true,
          });
          try {
            const { content, nextMemory } = await generateChapterWithQualityGate(item, currentChapters, currentMemory);
            currentMemory = nextMemory;
            currentChapters = { ...currentChapters, [item.chapterNumber]: content };
            setChapters(prev => ({ ...prev, [item.chapterNumber]: content }));
            okCount += 1;
          } catch (error: any) {
            failed.push(item.chapterNumber);
            pushToast(`第${item.chapterNumber}章失败：${error.message || '未知错误'}，已跳过继续`, 'error');
          }
        }
        setBatchFailedChapters(failed);
        setGeneratingChapterNum(null);
        setIsBatchGenerating(false);
        if (stopBatchRef.current || cancelTaskRef.current) {
          pushToast(`已停止。完成 ${okCount} 章，失败 ${failed.length} 章`, 'warn');
        } else if (failed.length > 0) {
          pushToast(`批量结束：成功 ${okCount}，失败 ${failed.length}（可点重试失败）`, 'warn');
        } else {
          pushToast(`批量完成：成功 ${okCount} 章`, 'success');
        }
      },
    });
  };

  const handleGenerateShortStoryTitles = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!shortStoryInfo.themes?.length, '请先选择至少一个主题', 'book', '去选题材')) return;
    await runTask({
      kind: 'shortTitles',
      label: '生成短篇标题',
      run: async () => {
      const titles = await generateShortStoryTitles(shortStoryInfo.themes, settings);
      setShortStoryTitleOptions(titles);
          },
    });
  };

  const handleGenerateShortStoryOutline = async () => {
    if (!ensureSettingsReady()) return;
    if (!requireGate(!!shortStoryInfo.title, '请先填写或选择一个故事标题', 'book', '去填标题')) return;
    await runTask({
      kind: 'shortOutline',
      label: '生成短篇分段',
      run: async () => {
      // 生成分段大纲
      const segments = await generateShortStorySegments(shortStoryInfo, settings);
      setShortStoryInfo({
        ...shortStoryInfo,
        segments,
        isOutlineGenerated: true,
      });
      pushToast(`已生成 ${segments.length} 段结构，可在下方编辑摘要`, 'success', { label: '去写正文', tab: 'chapters' });
          },
    });
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
    if (!ensureSettingsReady()) return;
    if (!shortStoryInfo.outline && (!shortStoryInfo.segments || shortStoryInfo.segments.length === 0)) {
      requireGate(false, '请先填写脑洞大纲，或生成分段规划', 'book', '去短篇设定');
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

    const segLabel = options?.forceFinal
      ? '生成短篇结局'
      : options?.rewrite
        ? `重写短篇第 ${(options.segmentIndex ?? 0) + 1} 段`
        : '生成短篇正文';
    await runTask({
      kind: 'shortContent',
      label: segLabel,
      cancellable: true,
      run: async () => {

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
        pushToast('检测到生成内容与已有内容高度重复，已跳过重复部分。建议重写当前段，或调整分段摘要后再生成。', 'warn');
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
      },
    });
  };


  const handleRewriteChapterByQuality = async (chapterNum: number) => {
    if (!ensureSettingsReady()) return;
    const tocItem = toc.find(t => t.chapterNumber === chapterNum);
    if (!tocItem) return;
    const notes = chapterQualityNotes[chapterNum] || [];
    await runTask({
      kind: 'chapter',
      label: `按质检重写第 ${chapterNum} 章`,
      cancellable: true,
      run: async () => {
        setGeneratingChapterNum(chapterNum);
        if (cancelTaskRef.current) throw new Error('已取消');
        const noteText = notes.length
          ? notes.join('\n- ')
          : '在保持剧情的前提下提升文笔、衔接与字数达标。';
        const patched: TOCItem = {
          ...tocItem,
          summary:
            (tocItem.summary || '') +
            `\n\n【质检重写要求】\n- ${noteText}\n请针对以上问题改写本章，保留主线与人物一致。`,
        };
        const existing = chapters[chapterNum] || '';
        const { content } = await generateChapterWithQualityGate(patched, chapters, novelMemory, {
          mode: 'rewrite',
          directive: noteText,
          existingContent: existing,
          onChunk: (full) => setChapters(prev => ({ ...prev, [chapterNum]: full })),
        });
        if (cancelTaskRef.current) throw new Error('已取消');
        setChapters(prev => ({ ...prev, [chapterNum]: content }));
        setActiveChapterNum(chapterNum);
        setActiveTab('chapters');
        setGeneratingChapterNum(null);
        pushToast(`第 ${chapterNum} 章已按质检意见重写`, 'success');
      },
    });
  };

  const handlePipelineToToc = async () => {
    if (!ensureSettingsReady()) return;
    if (!bookInfo.themes?.length) {
      requireGate(false, '请先选择主题', 'book', '去选题材');
      return;
    }
    if (!bookInfo.isTitleSelected || !bookInfo.title) {
      pushToast('请先生成并点选书名，再运行流水线', 'warn', { label: '去书籍信息', tab: 'book' });
      setActiveTab('book');
      return;
    }
    if (!bookInfo.outline) {
      await handleGenerateBookInfo();
    }
    if (cancelTaskRef.current) return;
    if (!characters.length) {
      await handleGenerateCharacters();
    }
    if (cancelTaskRef.current) return;
    if (!toc.length) {
      await handleGenerateTOC();
    }
    pushToast('流水线已尽量推进到目录（可随时停止任务）', 'success', { label: '去目录', tab: 'toc' });
  };

  const handleDownload = async (
    format: 'txt' | 'docx' = 'txt',
    opts?: { onlyWritten?: boolean; volumeSize?: number; withCover?: boolean }
  ) => {
    const onlyWritten = opts?.onlyWritten !== false; // 默认只导出已写章
    const withCover = opts?.withCover !== false;
    const volumeSize = opts?.volumeSize || 0;

    const buildCoverTxt = () => {
      const written = Object.keys(chapters).length;
      const words = Object.values(chapters).join('').replace(/\s/g, '').length;
      return (
        `《${bookInfo.title || '未命名小说'}》\n` +
        `题材：${(bookInfo.themes || []).join('、') || '未填'}\n` +
        `大纲：${(bookInfo.outline || '').slice(0, 200)}${(bookInfo.outline || '').length > 200 ? '…' : ''}\n` +
        `已写 ${written} 章 · 约 ${words} 字\n` +
        `导出时间：${new Date().toLocaleString()}\n\n————————\n\n`
      );
    };

    if (mode === 'novel') {
      if (Object.keys(chapters).length === 0) {
        pushToast('还没有已写章节可导出', 'warn');
        return;
      }
      if (format === 'docx') {
        await downloadNovelAsWord({ onlyWritten, volumeSize, withCover });
      } else if (volumeSize > 0) {
        // 分卷 txt
        const items = toc.filter(t => chapters[t.chapterNumber]);
        let vol = 1;
        for (let i = 0; i < items.length; i += volumeSize) {
          const slice = items.slice(i, i + volumeSize);
          let fullText = withCover ? buildCoverTxt() + `第 ${vol} 卷\n\n` : `《${bookInfo.title || '小说'}》第 ${vol} 卷\n\n`;
          slice.forEach(item => {
            fullText += `第${item.chapterNumber}章 ${item.title}\n\n${chapters[item.chapterNumber]}\n\n`;
          });
          downloadText(fullText, `${bookInfo.title || '小说'}_卷${vol}.txt`);
          vol += 1;
        }
        pushToast(`已导出 ${vol - 1} 个分卷 TXT`, 'success');
      } else {
        let fullText = withCover ? buildCoverTxt() : `《${bookInfo.title || '未命名小说'}》\n\n`;
        toc.forEach(item => {
          if (!onlyWritten || chapters[item.chapterNumber]) {
            if (chapters[item.chapterNumber]) {
              fullText += `第${item.chapterNumber}章 ${item.title}\n\n${chapters[item.chapterNumber]}\n\n`;
            }
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

  const downloadNovelAsWord = async (opts?: { onlyWritten?: boolean; volumeSize?: number; withCover?: boolean }) => {
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = await import('docx');
    const onlyWritten = opts?.onlyWritten !== false;
    const withCover = opts?.withCover !== false;
    const volumeSize = opts?.volumeSize || 0;
    const items = toc.filter(t => !onlyWritten || chapters[t.chapterNumber]).filter(t => chapters[t.chapterNumber]);

    const buildParas = (slice: typeof items, volLabel?: string) => {
      const paragraphs: any[] = [];
      if (withCover) {
        const written = Object.keys(chapters).length;
        const words = Object.values(chapters).join('').replace(/\s/g, '').length;
        paragraphs.push(new Paragraph({ text: bookInfo.title || '未命名小说', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
        if (volLabel) paragraphs.push(new Paragraph({ text: volLabel, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
        paragraphs.push(new Paragraph({ text: `题材：${(bookInfo.themes || []).join('、') || '未填'}`, spacing: { after: 120 } }));
        paragraphs.push(new Paragraph({ text: `已写 ${written} 章 · 约 ${words} 字`, spacing: { after: 120 } }));
        paragraphs.push(new Paragraph({ text: `导出：${new Date().toLocaleString()}`, spacing: { after: 300 } }));
        paragraphs.push(new Paragraph({ text: '————————', spacing: { after: 300 } }));
      } else {
        paragraphs.push(new Paragraph({ text: bookInfo.title || '未命名小说', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 } }));
      }
      slice.forEach(item => {
        paragraphs.push(new Paragraph({ text: `第${item.chapterNumber}章 ${item.title}`, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 200 } }));
        const content = chapters[item.chapterNumber];
        content.split(/\n+/).filter(p => p.trim()).forEach(para => {
          paragraphs.push(new Paragraph({ text: para.trim(), spacing: { after: 200 }, indent: { firstLine: 480 } }));
        });
        paragraphs.push(new Paragraph({ text: '' }));
      });
      return paragraphs;
    };

    if (volumeSize > 0) {
      let vol = 1;
      for (let i = 0; i < items.length; i += volumeSize) {
        const slice = items.slice(i, i + volumeSize);
        const doc = new Document({ sections: [{ properties: {}, children: buildParas(slice, `第 ${vol} 卷`) }] });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${bookInfo.title || '小说'}_卷${vol}.docx`);
        vol += 1;
      }
      pushToast(`已导出 ${vol - 1} 个分卷 Word`, 'success');
      return;
    }

    const doc = new Document({ sections: [{ properties: {}, children: buildParas(items) }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${bookInfo.title || '小说'}.docx`);
  };

  const downloadShortStoryAsWord = async () => {
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = await import('docx');
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
    <SettingsPanel
      mode={mode}
      settings={settings}
      setSettings={setSettings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      providerProfiles={providerProfiles}
      activeProfileId={activeProfileId}
      profileNameDraft={profileNameDraft}
      setProfileNameDraft={setProfileNameDraft}
      onActivateProfile={activateProviderProfile}
      onDeleteProfile={deleteProviderProfile}
      onBeginNewProfile={beginNewProviderProfile}
      onSaveProfile={saveProviderProfile}
      onProviderChange={handleProviderChange}
      onDetectModels={handleDetectModels}
    />
  );


  const renderBookInfo = () => (
    <BookPanel
      mode={mode}
      settings={settings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      pushToast={pushToast}
      bookInfo={bookInfo}
      setBookInfo={setBookInfo}
      characters={characters}
      setCharacters={setCharacters}
      realmProgress={realmProgress}
      setRealmProgress={setRealmProgress}
      toc={toc}
      setToc={setToc}
      chapters={chapters}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      shortStoryTitleOptions={shortStoryTitleOptions}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      tocCompact={tocCompact}
      setTocCompact={setTocCompact}
      tocMenuOpen={tocMenuOpen}
      setTocMenuOpen={setTocMenuOpen}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      setActiveTab={setActiveTab}
      chapterQualityNotes={chapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      getRealmSystemLabel={getRealmSystemLabel}
      themesRecommendRealms={themesRecommendRealms}
      handleGenerateBookTitles={handleGenerateBookTitles}
      handleGenerateBookInfo={handleGenerateBookInfo}
      handleSelectTitle={handleSelectBookTitle}
      handleBookThemesChange={handleBookThemesChange}
      handleBookTitleInput={handleBookTitleInput}
      handleBookPlanningFieldChange={handleBookPlanningFieldChange}
      handleLengthChange={handleLengthChange}
      handleGenerateCharacters={handleGenerateCharacters}
      handleAddCharacter={handleAddCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      handleUpdateCharacter={handleUpdateCharacter}
      handleGenerateRealms={handleGenerateRealms}
      handleGenerateTOC={handleGenerateTOC}
      handleGenerateSingleChapterOutline={handleGenerateSingleChapterOutline}
      handleRegenerateChapterOutline={handleRegenerateChapterOutline}
      handleDeleteChapterOutline={handleDeleteTOCItem}
      handleGenerateShortStoryTitles={handleGenerateShortStoryTitles}
      handleGenerateShortStoryOutline={handleGenerateShortStoryOutline}
      handleGenerateChapter={handleGenerateChapter}
    />
  );

  const renderCharacters = () => (
    <CharactersPanel
      mode={mode}
      settings={settings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      pushToast={pushToast}
      bookInfo={bookInfo}
      setBookInfo={setBookInfo}
      characters={characters}
      setCharacters={setCharacters}
      realmProgress={realmProgress}
      setRealmProgress={setRealmProgress}
      toc={toc}
      setToc={setToc}
      chapters={chapters}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      shortStoryTitleOptions={shortStoryTitleOptions}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      tocCompact={tocCompact}
      setTocCompact={setTocCompact}
      tocMenuOpen={tocMenuOpen}
      setTocMenuOpen={setTocMenuOpen}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      setActiveTab={setActiveTab}
      chapterQualityNotes={chapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      getRealmSystemLabel={getRealmSystemLabel}
      themesRecommendRealms={themesRecommendRealms}
      handleGenerateBookTitles={handleGenerateBookTitles}
      handleGenerateBookInfo={handleGenerateBookInfo}
      handleSelectTitle={handleSelectBookTitle}
      handleBookThemesChange={handleBookThemesChange}
      handleBookTitleInput={handleBookTitleInput}
      handleBookPlanningFieldChange={handleBookPlanningFieldChange}
      handleLengthChange={handleLengthChange}
      handleGenerateCharacters={handleGenerateCharacters}
      handleAddCharacter={handleAddCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      handleUpdateCharacter={handleUpdateCharacter}
      handleGenerateRealms={handleGenerateRealms}
      handleGenerateTOC={handleGenerateTOC}
      handleGenerateSingleChapterOutline={handleGenerateSingleChapterOutline}
      handleRegenerateChapterOutline={handleRegenerateChapterOutline}
      handleDeleteChapterOutline={handleDeleteTOCItem}
      handleGenerateShortStoryTitles={handleGenerateShortStoryTitles}
      handleGenerateShortStoryOutline={handleGenerateShortStoryOutline}
      handleGenerateChapter={handleGenerateChapter}
    />
  );

  const renderRealms = () => (
    <RealmsPanel
      mode={mode}
      settings={settings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      pushToast={pushToast}
      bookInfo={bookInfo}
      setBookInfo={setBookInfo}
      characters={characters}
      setCharacters={setCharacters}
      realmProgress={realmProgress}
      setRealmProgress={setRealmProgress}
      toc={toc}
      setToc={setToc}
      chapters={chapters}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      shortStoryTitleOptions={shortStoryTitleOptions}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      tocCompact={tocCompact}
      setTocCompact={setTocCompact}
      tocMenuOpen={tocMenuOpen}
      setTocMenuOpen={setTocMenuOpen}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      setActiveTab={setActiveTab}
      chapterQualityNotes={chapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      getRealmSystemLabel={getRealmSystemLabel}
      themesRecommendRealms={themesRecommendRealms}
      handleGenerateBookTitles={handleGenerateBookTitles}
      handleGenerateBookInfo={handleGenerateBookInfo}
      handleSelectTitle={handleSelectBookTitle}
      handleBookThemesChange={handleBookThemesChange}
      handleBookTitleInput={handleBookTitleInput}
      handleBookPlanningFieldChange={handleBookPlanningFieldChange}
      handleLengthChange={handleLengthChange}
      handleGenerateCharacters={handleGenerateCharacters}
      handleAddCharacter={handleAddCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      handleUpdateCharacter={handleUpdateCharacter}
      handleGenerateRealms={handleGenerateRealms}
      handleGenerateTOC={handleGenerateTOC}
      handleGenerateSingleChapterOutline={handleGenerateSingleChapterOutline}
      handleRegenerateChapterOutline={handleRegenerateChapterOutline}
      handleDeleteChapterOutline={handleDeleteTOCItem}
      handleGenerateShortStoryTitles={handleGenerateShortStoryTitles}
      handleGenerateShortStoryOutline={handleGenerateShortStoryOutline}
      handleGenerateChapter={handleGenerateChapter}
    />
  );

  const renderTOC = () => (
    <TocPanel
      mode={mode}
      settings={settings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      pushToast={pushToast}
      bookInfo={bookInfo}
      setBookInfo={setBookInfo}
      characters={characters}
      setCharacters={setCharacters}
      realmProgress={realmProgress}
      setRealmProgress={setRealmProgress}
      toc={toc}
      setToc={setToc}
      chapters={chapters}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      shortStoryTitleOptions={shortStoryTitleOptions}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      tocCompact={tocCompact}
      setTocCompact={setTocCompact}
      tocMenuOpen={tocMenuOpen}
      setTocMenuOpen={setTocMenuOpen}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      setActiveTab={setActiveTab}
      chapterQualityNotes={chapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      getRealmSystemLabel={getRealmSystemLabel}
      themesRecommendRealms={themesRecommendRealms}
      handleGenerateBookTitles={handleGenerateBookTitles}
      handleGenerateBookInfo={handleGenerateBookInfo}
      handleSelectTitle={handleSelectBookTitle}
      handleBookThemesChange={handleBookThemesChange}
      handleBookTitleInput={handleBookTitleInput}
      handleBookPlanningFieldChange={handleBookPlanningFieldChange}
      handleLengthChange={handleLengthChange}
      handleGenerateCharacters={handleGenerateCharacters}
      handleAddCharacter={handleAddCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      handleUpdateCharacter={handleUpdateCharacter}
      handleGenerateRealms={handleGenerateRealms}
      handleGenerateTOC={handleGenerateTOC}
      handleGenerateSingleChapterOutline={handleGenerateSingleChapterOutline}
      handleRegenerateChapterOutline={handleRegenerateChapterOutline}
      handleDeleteChapterOutline={handleDeleteTOCItem}
      handleGenerateShortStoryTitles={handleGenerateShortStoryTitles}
      handleGenerateShortStoryOutline={handleGenerateShortStoryOutline}
      handleGenerateChapter={handleGenerateChapter}
    />
  );

  const renderExamples = () => (
    <ExamplesPanel
      mode={mode}
      settings={settings}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      pushToast={pushToast}
      bookInfo={bookInfo}
      setBookInfo={setBookInfo}
      characters={characters}
      setCharacters={setCharacters}
      realmProgress={realmProgress}
      setRealmProgress={setRealmProgress}
      toc={toc}
      setToc={setToc}
      chapters={chapters}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      shortStoryTitleOptions={shortStoryTitleOptions}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      tocCompact={tocCompact}
      setTocCompact={setTocCompact}
      tocMenuOpen={tocMenuOpen}
      setTocMenuOpen={setTocMenuOpen}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      setActiveTab={setActiveTab}
      chapterQualityNotes={chapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      getRealmSystemLabel={getRealmSystemLabel}
      themesRecommendRealms={themesRecommendRealms}
      handleGenerateBookTitles={handleGenerateBookTitles}
      handleGenerateBookInfo={handleGenerateBookInfo}
      handleSelectTitle={handleSelectBookTitle}
      handleBookThemesChange={handleBookThemesChange}
      handleBookTitleInput={handleBookTitleInput}
      handleBookPlanningFieldChange={handleBookPlanningFieldChange}
      handleLengthChange={handleLengthChange}
      handleGenerateCharacters={handleGenerateCharacters}
      handleAddCharacter={handleAddCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      handleUpdateCharacter={handleUpdateCharacter}
      handleGenerateRealms={handleGenerateRealms}
      handleGenerateTOC={handleGenerateTOC}
      handleGenerateSingleChapterOutline={handleGenerateSingleChapterOutline}
      handleRegenerateChapterOutline={handleRegenerateChapterOutline}
      handleDeleteChapterOutline={handleDeleteTOCItem}
      handleGenerateShortStoryTitles={handleGenerateShortStoryTitles}
      handleGenerateShortStoryOutline={handleGenerateShortStoryOutline}
      handleGenerateChapter={handleGenerateChapter}
    />
  );

  const renderChapters = () => (
    <ChaptersPanel
      mode={mode}
      shortStoryInfo={shortStoryInfo}
      setShortStoryInfo={setShortStoryInfo}
      setShortStoryTitleOptions={setShortStoryTitleOptions}
      showShortResetMenu={showShortResetMenu}
      setShowShortResetMenu={setShowShortResetMenu}
      chapterReadMode={chapterReadMode}
      setChapterReadMode={setChapterReadMode}
      toc={toc}
      chapters={chapters}
      setChapters={setChapters}
      activeChapterNum={activeChapterNum}
      setActiveChapterNum={setActiveChapterNum}
      chapterQualityNotes={chapterQualityNotes}
      setChapterQualityNotes={setChapterQualityNotes}
      batchFailedChapters={batchFailedChapters}
      isTaskBusy={isTaskBusy}
      isGenerating={isGenerating}
      isBatchGenerating={isBatchGenerating}
      generatingChapterNum={generatingChapterNum}
      onGenerateShort={handleGenerateShortStoryContent}
      onGenerateChapter={handleGenerateChapter}
      onChapterAction={(n, action) => handleGenerateChapter(n, action)}
      onDeleteChapter={handleDeleteChapter}
      onBatchGenerate={handleBatchGenerateChapters}
      onStopBatch={handleStopBatchGenerate}
      onFillMissingChapters={() => handleBatchGenerateChapters({ onlyMissing: true, limit: 50 })}
      onRewriteByQuality={handleRewriteChapterByQuality}
      onPipelineToToc={handlePipelineToToc}
      minWordCount={settings.minWordCount || 2000}
      targetChapterCount={bookInfo.targetChapterCount || 0}
    />
  );


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
          pushToast('无效的备份文件！', 'error');
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
        pushToast('数据恢复成功！', 'success');
      } catch (err) {
        pushToast('恢复失败：文件格式错误', 'error');
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
    pushToast('已重开新书，API 设置保持不变', 'success');
  };

  const navItems = mode === 'novel' 
    ? [
        { id: 'settings', icon: SettingsIcon, label: '设置' },
        { id: 'book', icon: BookOpen, label: '书籍信息' },
        { id: 'characters', icon: Users, label: '人物关系' },
        ...(bookInfo.enableRealms !== false ? [{ id: 'realms', icon: Globe, label: getRealmSystemLabel(bookInfo.themes).title }] : []),
        { id: 'toc', icon: List, label: '大纲目录' },
        { id: 'memory', icon: BookOpen, label: '作品记忆' },
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
      <AppSidebar
        mode={mode}
        activeTab={activeTab}
        navItems={navItems}
        progress={
          mode === 'novel'
            ? {
                doneSteps: novelProgress.doneSteps,
                score: novelProgress.score,
                nextHint: novelProgress.nextHint,
                tocCount: novelProgress.tocCount,
                written: novelProgress.written,
                target: novelProgress.target,
              }
            : {
                doneSteps: shortProgress.doneSteps,
                score: shortProgress.score,
                nextHint: shortProgress.nextHint,
                segTotal: shortProgress.segTotal,
                doneSegs: shortProgress.doneSegs,
                words: shortProgress.words,
                target: shortProgress.target,
              }
        }
        chaptersCount={Object.keys(chapters).length}
        shortHasContent={!!shortStoryInfo.content}
        showDownloadMenu={showDownloadMenu}
        showResetConfirm={showResetConfirm}
        onModeNovel={() => {
          setMode('novel');
          setActiveTab('book');
        }}
        onModeShort={() => {
          setMode('shortStory');
          setActiveTab('book');
        }}
        onNav={(id) => setActiveTab(id as Tab)}
        onToggleDownloadMenu={() => setShowDownloadMenu(!showDownloadMenu)}
        onDownloadTxt={() => {
          handleDownload('txt', { onlyWritten: true, withCover: true });
          setShowDownloadMenu(false);
        }}
        onDownloadDocx={() => {
          handleDownload('docx', { onlyWritten: true, withCover: true });
          setShowDownloadMenu(false);
        }}
        onDownloadTxtVolumes={() => {
          handleDownload('txt', { onlyWritten: true, withCover: true, volumeSize: 30 });
          setShowDownloadMenu(false);
        }}
        onDownloadDocxVolumes={() => {
          handleDownload('docx', { onlyWritten: true, withCover: true, volumeSize: 30 });
          setShowDownloadMenu(false);
        }}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onResetBook={handleResetBookInfo}
        onResetAll={handleReset}
      />

      <div className="ui-main-panel flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <AppHeader
          activeTab={activeTab}
          mode={mode}
          realmTitle={getRealmSystemLabel(bookInfo.themes).title}
          taskState={taskState}
          isBatchGenerating={isBatchGenerating}
          providerProfiles={providerProfiles}
          activeProfileId={activeProfileId}
          bookTitle={bookInfo.title}
          shortTitle={shortStoryInfo.title}
          chapterWritten={Object.keys(chapters).length}
          chapterTarget={bookInfo.targetChapterCount || 0}
          onActivateProfile={activateProviderProfile}
          onCancelTask={requestCancelTask}
          onRetryTask={() => {
            void retryLastTask();
          }}
          onClearTask={clearTask}
        />

        <main className={`flex-1 min-h-0 overflow-y-auto ${activeTab === 'chapters' ? 'p-0' : 'p-5 md:p-8'}`}>
          {activeTab !== 'settings' && !settingsReady(settings).ok && (
            <div className="mx-5 md:mx-8 mt-4 mb-0 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
              <span>设置未就绪：{settingsReady(settings).reason || '请完善 API 配置'}（开始生成前请先配置）</span>
              <button type="button" className="text-xs font-semibold text-[var(--ui-accent-text)]" onClick={() => setActiveTab('settings')}>
                去设置
              </button>
            </div>
          )}
          {activeTab === 'settings' && renderSettings()}
          {activeTab === 'book' && renderBookInfo()}
          {activeTab === 'characters' && renderCharacters()}
          {activeTab === 'realms' && renderRealms()}
          {activeTab === 'toc' && renderTOC()}
          {activeTab === 'memory' && mode === 'novel' && (
            <MemoryPanel novelMemory={novelMemory} setNovelMemory={setNovelMemory} editable={memoryEditable} setEditable={setMemoryEditable} />
          )}
          {activeTab === 'chapters' && renderChapters()}
          {activeTab === 'examples' && renderExamples()}
        </main>
      </div>

      <DownstreamConfirmModal
        state={downstreamConfirm}
        onCancel={() => setDownstreamConfirm(null)}
        onConfirm={resolveDownstreamConfirm}
      />
      <ToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        onAction={(tab, id) => {
          setActiveTab(tab as Tab);
          dismissToast(id);
        }}
      />
    </div>
  );
}
