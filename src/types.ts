export type Provider = 'gemini' | 'openai' | 'deepseek' | 'zhipu' | 'moonshot' | 'custom' | 'kilo' | 'free';

export interface Settings {
  provider: Provider;
  apiKey: string;
  apiKeys: string[]; // 多密钥轮询（主要用于免费提供商）
  currentKeyIndex: number; // 当前使用的密钥索引
  baseUrl: string;
  model: string;
  availableModels: ModelInfo[]; // 可用模型列表
  minWordCount: number;
  temperature: number; // 温度参数，控制创作自由度 (0-2)
  promptOverride?: PromptOverride; // Prompt 工坊：创作偏好注入
}

export type PromptTaskKey = 'chapter' | 'bookInfo' | 'characters' | 'toc' | 'shortContent';

export interface PromptOverride {
  globalPrefix: string; // 注入所有生成任务的全局创作偏好
  taskExtra: Partial<Record<PromptTaskKey, string>>; // 按任务的附加指令
}

export interface PromptPreset {
  id: string;
  name: string;
  override: PromptOverride;
  createdAt: number;
}

export type EntityCardType = 'character' | 'location' | 'item' | 'faction' | 'thread';

export interface EntityCard {
  id: string;
  name: string;
  type: EntityCardType;
  description: string;
  keywords: string[]; // 命中关键词才注入；pinned 则每章必注入
  pinned: boolean;
  enabled: boolean;
  createdAt: number;
}

export interface StyleCard {
  id: string;
  name: string;
  traits: string; // AI 提取的风格特征，生成时注入
  excerpt: string; // 原文样本（截断保存）
  enabled: boolean;
  createdAt: number;
}

export interface WritingEvent {
  date: string; // YYYY-MM-DD
  ts: number;
  chapter: number;
  words: number; // 相对上一版的增量
}

export interface ChapterVersion {
  content: string;
  words: number;
  ts: number;
  label: string;
}

export interface ChapterVersionMap {
  [chapter: number]: ChapterVersion[];
}

export interface RepairTask {
  chapterNumber: number;
  reason: string;
  selected: boolean;
  done: boolean;
}

export interface RepairFlowState {
  field: 'outline' | 'worldbuilding';
  status: 'analyzing' | 'review' | 'repairing' | 'done';
  tasks: RepairTask[];
  currentIndex: number; // 正在修复第几章（1-based 计数），-1 未开始
  bookInfoSnapshot: BookInfo; // 修复时使用的新版书籍设定
}

export interface ChapterDraft {
  id: string;
  content: string;
  words: number;
  angle: string;
}


export interface ProviderProfile {
  id: string;
  name: string;
  provider: Provider;
  apiKey: string;
  apiKeys: string[];
  currentKeyIndex: number;
  baseUrl: string;
  model: string;
  availableModels: ModelInfo[];
  updatedAt: number;
}

export interface BookInfo {
  title: string;
  themes: string[];
  lengthType: string;
  targetChapterCount: number;
  outline: string;
  worldbuilding: string;
  endingOutline: string;
  titleOptions?: Array<{title: string, intro: string}>; // 生成的书名选项列表（含介绍）
  isTitleSelected?: boolean; // 是否已选择书名
  enableRealms?: boolean; // 是否启用境界体系
}

export interface NovelMemory {
  storySoFar: string;
  characterStates: string;
  openThreads: string[];
  resolvedThreads: string[];
  importantItems: string[];
  lastUpdatedChapter: number;
}

export interface StorySegment {
  segmentNumber: number;
  title: string;
  wordCount: number;
  summary: string;
  content: string;
  isGenerated: boolean;
}

export interface ShortStoryInfo {
  title: string;
  themes: string[];
  targetWordCount: number;
  outline: string;
  content: string;
  segments: StorySegment[];
  currentSegment: number; // 当前正在生成的分段
  isOutlineGenerated: boolean;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface SubRealm {
  name: string;         // 如 "初期" "中期" "后期" "圆满"
  description: string; // 简要描述
}

export interface Realm {
  id: string;
  name: string;
  level: number;
  description: string;
  breakthroughCondition: string;
  subRealms: SubRealm[]; // 小境界，如 [初期, 中期, 后期, 圆满]
}

export interface RealmProgress {
  realms: Realm[];
  protagonistCurrentRealmIndex: number;
  protagonistCurrentSubRealmIndex: number; // 当前大境界内的小境界索引
  chapterRealmMap: Record<number, { realmIndex: number; subRealmIndex: number }>; // chapterNumber -> {大境界索引, 小境界索引}
}

export interface TOCItem {
  chapterNumber: number;
  title: string;
  summary: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: Provider;
  contextLength?: number;
}
