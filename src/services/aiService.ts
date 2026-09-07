import { GoogleGenAI } from "@google/genai";
import { Settings, BookInfo, Character, TOCItem, ShortStoryInfo, StorySegment, Realm, SubRealm, RealmProgress, NovelMemory, PromptTaskKey } from "../types";
import { getThemePrompt } from "../config/themes";
import { normalizeBaseUrl, proxyFetch } from '../lib/devProxy';

export type ChapterGenMode = 'write' | 'continue' | 'expand' | 'conclude' | 'rewrite';

export type ChapterGenOptions = {
  mode?: ChapterGenMode;
  directive?: string;
  existingContent?: string;
  signal?: AbortSignal;
  onChunk?: (fullText: string) => void;
  entityContext?: string; // 本章相关设定卡（由 App 按相关性挑选）
  styleDirective?: string; // 启用的风格卡特征
  previousChapterNumbers?: number[]; // 与 previousChapters 一一对应的章节号
  skipMemoryUpdate?: boolean; // 多稿等场景先生成正文，选定后再统一更新记忆
};


function extractJSON(text: string): any {
  // 提取JSON文本
  let jsonStr = text;
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    jsonStr = match[1];
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 尝试自动修复常见JSON错误
    try {
      // 修复1: 数组元素之间缺少 } (如 }  { → }, {)
      let fixed = jsonStr.replace(/\}\s*\{/g, '}, {');
      // 修复1b: 对象之间完全缺少闭合}（如 "字符串值"\n    { → "字符串值"}\n    {）
      fixed = fixed.replace(/"\s*\n(\s*)\{/g, '"}\n$1{');
      // 修复2: 末尾多余的逗号
      fixed = fixed.replace(/,\s*([}\]])/g, '$1');
      // 修复3: AI把键值对写成 "key:value" 而非 "key":value（如 "chapterNumber:124" → "chapterNumber":124）
      fixed = fixed.replace(/"(\w+):(\d+)"\s*:/g, '"$1":$2,');
      // 修复4: 缺少闭合的 } (统计 { 和 } 数量，补齐)
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      if (openBraces > closeBraces) {
        fixed += '}'.repeat(openBraces - closeBraces);
      }
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/]/g) || []).length;
      if (openBrackets > closeBrackets) {
        fixed += ']'.repeat(openBrackets - closeBrackets);
      }
      return JSON.parse(fixed);
    } catch (e2) {
      console.error("Failed to parse JSON:", text);
      throw new Error("AI 返回的数据格式不正确，请重试。");
    }
  }
}

function ensureArray<T = any>(value: any, fieldName: string): T[] {
  if (Array.isArray(value)) return value;
  throw new Error(`AI 返回的数据缺少有效的 ${fieldName} 数组，请重试。`);
}

// Prompt 工坊：把用户创作偏好拼接到任务 Prompt 尾部
function promptOverrideSuffix(settings: Settings, task: PromptTaskKey): string {
  const po = settings?.promptOverride;
  if (!po) return '';
  const parts: string[] = [];
  if (po.globalPrefix?.trim()) parts.push(po.globalPrefix.trim());
  const extra = po.taskExtra?.[task];
  if (extra?.trim()) parts.push(extra.trim());
  if (parts.length === 0) return '';
  return `\n\n【创作偏好（用户设定，请优先遵守）】\n${parts.join('\n')}`;
}

function cleanText(value: any): string {
  return typeof value === 'string' ? value.trim() : '';
}

const FINAL_ONLY_TITLE_PATTERN = /(大结局|最终章|终章|尾声|完结|结局篇|全书终)/;
const EARLY_ENDING_TITLE_PATTERN = /(大结局|最终章|终章|尾声|完结|结局篇|全书终|终局|最后一战|最后的决战|落幕|归宿|终焉|谢幕|尘埃落定|一切终结)/;

function getClosingTitleStart(targetChapterCount: number): number {
  const closingWindow = Math.max(5, Math.ceil(targetChapterCount * 0.05));
  return Math.max(1, targetChapterCount - closingWindow + 1);
}

function getEndingTitleIssue(title: string, chapterNumber: number, targetChapterCount: number): string | undefined {
  if (FINAL_ONLY_TITLE_PATTERN.test(title) && chapterNumber !== targetChapterCount) {
    return `第${chapterNumber}章标题“${title}”过早使用大结局/终章类词汇`;
  }

  const closingTitleStart = getClosingTitleStart(targetChapterCount);
  if (EARLY_ENDING_TITLE_PATTERN.test(title) && chapterNumber < closingTitleStart) {
    return `第${chapterNumber}章标题“${title}”带有结局感，只能放在第${closingTitleStart}章之后`;
  }

  return undefined;
}

/** 把过早结局感标题改成中性推进标题，避免整批目录作废 */
function sanitizeEndingTitle(title: string, chapterNumber: number): string {
  let t = title;
  t = t
    .replace(/大结局|最终章|终章|尾声|完结篇?|结局篇|全书终/g, '转折')
    .replace(/终局|最后一战|最后的决战/g, '决战前夜')
    .replace(/落幕|归宿|终焉|谢幕|尘埃落定|一切终结/g, '变局')
    .replace(/最终(?!章)/g, '关键')
    .replace(/终点站?/g, '中途站')
    .replace(/没有终点/g, '前路未尽');
  t = t.replace(/^[·\-—\s]+|[·\-—\s]+$/g, '').trim();
  if (!t || t === title) {
    t = `第${chapterNumber}章·暗流`;
  }
  // 避免 sanitize 后仍触发
  if (EARLY_ENDING_TITLE_PATTERN.test(t) || FINAL_ONLY_TITLE_PATTERN.test(t)) {
    t = `暗流涌动·${chapterNumber}`;
  }
  return t;
}

function validateBookTitles(data: any): Array<{ title: string; intro: string }> {
  return ensureArray<any>(data?.titles, 'titles')
    .map(item => ({
      title: cleanText(item?.title),
      intro: cleanText(item?.intro),
    }))
    .filter(item => item.title && item.intro)
    .slice(0, 5);
}

function validateCharacters(data: any): Character[] {
  const names = new Set<string>();
  const characters = ensureArray<any>(data?.characters, 'characters')
    .map((item, index) => ({
      id: cleanText(item?.id) || `char${index + 1}`,
      name: cleanText(item?.name),
      role: cleanText(item?.role),
      description: cleanText(item?.description),
    }))
    .filter(item => item.name && item.role && item.description)
    .filter(item => {
      if (names.has(item.name)) return false;
      names.add(item.name);
      return true;
    });

  if (characters.length === 0) {
    throw new Error('AI 返回的人物设定为空或字段不完整，请重试。');
  }
  return characters;
}

function normalizeSummaryKey(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：""''（）()【】\[\]《》…—\-_,.!?;:'"]+/g, '')
    .slice(0, 100);
}

function summaryTooSimilar(a: string, b: string): boolean {
  const sa = normalizeSummaryKey(a);
  const sb = normalizeSummaryKey(b);
  if (!sa || !sb) return false;
  if (sa === sb) return true;
  if (sa.includes(sb) || sb.includes(sa)) return true;
  // bigram overlap
  const gram = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const A = gram(sa);
  const B = gram(sb);
  if (A.size === 0 || B.size === 0) return false;
  let inter = 0;
  A.forEach(x => { if (B.has(x)) inter += 1; });
  return inter / Math.max(A.size, B.size) >= 0.55;
}

function validateTOC(
  data: any,
  startIndex: number,
  endIndex: number,
  existingTitles: string[],
  targetChapterCount = endIndex,
  existingSummaries: string[] = []
): TOCItem[] {
  const titleSet = new Set(existingTitles.map(title => title.trim()));
  const summaryPool = existingSummaries.map(s => cleanText(s)).filter(Boolean);
  const byChapter = new Map<number, TOCItem>();
  const sanitizedNotes: string[] = [];

  ensureArray<any>(data?.chapters, 'chapters').forEach(item => {
    const chapterNumber = Number(item?.chapterNumber);
    let title = cleanText(item?.title);
    const summary = cleanText(item?.summary);
    if (!Number.isInteger(chapterNumber) || chapterNumber < startIndex || chapterNumber > endIndex) return;
    if (!title || !summary) return;
    if (summaryPool.some(prev => summaryTooSimilar(summary, prev))) return;

    const endingTitleIssue = getEndingTitleIssue(title, chapterNumber, targetChapterCount);
    if (endingTitleIssue) {
      // 软处理：自动改标题并保留本章，绝不因一条标题毁掉整批
      const fixed = sanitizeEndingTitle(title, chapterNumber);
      let unique = fixed;
      let n = 2;
      while (titleSet.has(unique)) {
        unique = `${fixed}·${n++}`;
      }
      sanitizedNotes.push(`第${chapterNumber}章「${title}」→「${unique}」（避免过早结局感）`);
      title = unique;
    }

    if (titleSet.has(title)) return;

    if (!byChapter.has(chapterNumber)) {
      byChapter.set(chapterNumber, { chapterNumber, title, summary });
      titleSet.add(title);
      summaryPool.push(summary);
    }
  });

  const chapters = Array.from(byChapter.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  // 附带软改写说明（供上层 toast；不抛错）
  (chapters as any).__sanitizedNotes = sanitizedNotes;
  return chapters;
}

function validateRealms(data: any): Realm[] {
  const realms = ensureArray<any>(data?.realms, 'realms')
    .map((item, index) => ({
      id: cleanText(item?.id) || `realm${index + 1}`,
      name: cleanText(item?.name),
      level: Number(item?.level) || index + 1,
      description: cleanText(item?.description),
      breakthroughCondition: cleanText(item?.breakthroughCondition) || '已至巅峰',
      subRealms: Array.isArray(item?.subRealms)
        ? item.subRealms.map((sub: any) => ({
            name: cleanText(sub?.name),
            description: cleanText(sub?.description),
          })).filter((sub: SubRealm) => sub.name)
        : [],
    }))
    .filter(item => item.name && item.description);

  if (realms.length === 0) {
    throw new Error('AI 返回的境界体系为空或字段不完整，请重试。');
  }
  return realms;
}

function validateSegments(data: any, targetWordCount = 10000): StorySegment[] {
  const rawSegments = Array.isArray(data) ? data : data?.segments;
  const segments = ensureArray<any>(rawSegments, 'segments')
    .map((seg, index) => ({
      segmentNumber: index + 1,
      title: cleanText(seg?.title),
      wordCount: Number(seg?.wordCount) || 0,
      summary: cleanText(seg?.summary),
      content: '',
      isGenerated: false,
    }))
    .filter(seg => seg.title && seg.summary);

  if (segments.length === 0) {
    throw new Error('AI 返回的分段大纲为空或字段不完整，请重试。');
  }

  // 将模型随手填写的字数归一化到目标总字数，避免后续每段目标失真、最后一段异常过长或过短。
  const requestedTarget = Math.max(Number(targetWordCount) || 10000, segments.length * 200);
  const minimum = Math.min(300, Math.max(180, Math.floor(requestedTarget / segments.length)));
  const weights = segments.map(segment => Math.max(1, segment.wordCount));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map(weight => Math.max(minimum, Math.round(requestedTarget * weight / weightTotal)));
  let difference = requestedTarget - counts.reduce((sum, count) => sum + count, 0);

  // 把四舍五入产生的误差集中修正到字数最多的分段，保证总量稳定。
  const order = counts.map((_, index) => index).sort((a, b) => counts[b] - counts[a]);
  let cursor = 0;
  while (difference !== 0 && order.length > 0) {
    const index = order[cursor % order.length];
    if (difference > 0) {
      counts[index] += 1;
      difference -= 1;
    } else if (counts[index] > minimum) {
      counts[index] -= 1;
      difference += 1;
    }
    cursor += 1;
    if (cursor > requestedTarget * 2) break;
  }

  return segments.map((segment, index) => ({
    ...segment,
    wordCount: counts[index],
  }));
}

// ???????? OpenAI ?? API
async function callOpenAIWithKey(
  prompt: string, 
  settings: Settings, 
  apiKey: string,
  expectJSON: boolean,
  opts?: { signal?: AbortSignal; stream?: boolean; onChunk?: (fullText: string) => void }
): Promise<{ success: boolean; content?: string; error?: string; isAuthError?: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const model = settings.model?.trim();
  if (!model) {
    return { success: false, error: 'No model is configured for the selected provider.' };
  }

  const messages = [{ role: 'user', content: prompt }];
  const body: any = {
    model,
    messages,
    temperature: settings.temperature || 0.9
  };
  if (opts?.stream && !expectJSON) {
    body.stream = true;
  }

  if (expectJSON) {
    messages[0].content += "\n\n请务必返回合法的 JSON 格式对象，不要包含任何其他文字或 Markdown 标记。";
  }

  try {
    const res = await proxyFetch(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: opts?.signal,
    });

    // 检查是否是认证错误（401/403），这类错误可以尝试下一个密钥
    if (res.status === 401 || res.status === 403) {
      const err = await res.text();
      return { success: false, error: err, isAuthError: true };
    }

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `API 请求失败 (${res.status}): ${err}` };
    }

    if (opts?.stream && !expectJSON && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let full = '';
      let buffer = '';
      const EMIT_INTERVAL_MS = 100;
      let lastEmitAt = 0;
      let emittedText = '';
      const emitChunk = (text: string, force = false) => {
        if (!opts?.onChunk || !text || text === emittedText) return;
        const now = Date.now();
        if (!force && now - lastEmitAt < EMIT_INTERVAL_MS) return;
        lastEmitAt = now;
        emittedText = text;
        opts.onChunk(text);
      };
      while (true) {
        if (opts.signal?.aborted) {
          try { await reader.cancel(); } catch { /* ignore */ }
          throw new DOMException('Aborted', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const rawLine of parts) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              full += delta;
              emitChunk(full);
            }
            const msg = json.choices?.[0]?.message?.content;
            if (typeof msg === 'string' && msg && !delta) {
              full = msg;
              emitChunk(full, true);
            }
          } catch { /* skip */ }
        }
      }
      emitChunk(full, true);
      return { success: true, content: full };
    }

    const data = await res.json();
    
    // 安全检查 API 响应格式
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      if (data.error) {
        return { success: false, error: `API 错误: ${data.error.message || data.error.code || JSON.stringify(data.error)}` };
      }
      return { success: false, error: `API 返回格式异常: ${JSON.stringify(data).slice(0, 200)}` };
    }
    
    if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
      return { success: false, error: 'API 返回内容异常，缺少 message.content 字段' };
    }
    
    return { success: true, content: data.choices[0].message.content || "" };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { success: false, error: '已取消' };
    }
    return { success: false, error: e.message || '网络请求失败' };
  }
}

async function callAI(prompt: string, settings: Settings, expectJSON: boolean = false, opts?: { signal?: AbortSignal; stream?: boolean; onChunk?: (fullText: string) => void }): Promise<string> {
  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey || process.env.GEMINI_API_KEY });
    const config: any = { temperature: settings.temperature || 0.9 };
    
    if (expectJSON) {
      config.responseMimeType = "application/json";
    }

    const response = await ai.models.generateContent({
      model: settings.model || 'gemini-3.1-pro-preview',
      contents: prompt,
      config
    });
    
    // 安全检查 Gemini 响应
    if (!response) {
      console.error('Gemini API 返回空响应');
      throw new Error('AI 返回空响应，请重试');
    }
    
    return response.text || "";
  } else {
    // Custom / OpenAI compatible endpoint (DeepSeek, Zhipu, Moonshot, etc.)
    // 免费提供商支持多密钥轮询
    const isFreeProvider = settings.provider === 'free';
    const keysToTry = isFreeProvider && settings.apiKeys.length > 0 
      ? settings.apiKeys 
      : [settings.apiKey];
    
    // 读取失败密钥记录（带冷却期）
    const COOLDOWN_MS = 30 * 60 * 1000; // 30分钟冷却期
    let failedKeys: Record<string, number> = {};
    if (isFreeProvider && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ai_novel_failed_keys');
        if (stored) {
          failedKeys = JSON.parse(stored);
          // 清理过期的记录（超过30分钟）
          const now = Date.now();
          Object.keys(failedKeys).forEach(key => {
            if (now - failedKeys[key] > COOLDOWN_MS) {
              delete failedKeys[key];
            }
          });
        }
      } catch (e) {
        console.error('读取失败密钥记录失败:', e);
      }
    }
    
    // 对密钥进行排序：未失败的优先，失败的按时间远近排序
    const now = Date.now();
    const sortedIndices = keysToTry.map((_, idx) => idx).sort((a, b) => {
      const keyA = keysToTry[a];
      const keyB = keysToTry[b];
      const failedA = failedKeys[keyA] || 0;
      const failedB = failedKeys[keyB] || 0;
      // 都未失败或都失败，按原始顺序
      if ((failedA === 0 && failedB === 0) || (failedA > 0 && failedB > 0)) {
        return a - b;
      }
      // 未失败的排前面
      return failedA - failedB;
    });
    
    // 从当前索引开始轮询（在排序后的列表中找到起始位置）
    const startPos = isFreeProvider 
      ? Math.max(0, sortedIndices.indexOf(settings.currentKeyIndex))
      : 0;
    const errors: string[] = [];
    
    for (let i = 0; i < sortedIndices.length; i++) {
      const pos = (startPos + i) % sortedIndices.length;
      const keyIndex = sortedIndices[pos];
      const apiKey = keysToTry[keyIndex];
      
      if (!apiKey) continue;
      
      // 检查是否在冷却期（仅记录认证错误的密钥）
      const failedAt = failedKeys[apiKey];
      if (failedAt && now - failedAt < COOLDOWN_MS) {
        const remainingMin = Math.ceil((COOLDOWN_MS - (now - failedAt)) / 60000);
        errors.push(`密钥${keyIndex + 1}: 冷却中(${remainingMin}分钟后重试)`);
        continue;
      }
      
      const result = await callOpenAIWithKey(prompt, settings, apiKey, expectJSON, opts);
      
      if (result.success && result.content !== undefined) {
        // 成功，将该密钥从失败列表中移除
        if (isFreeProvider && typeof window !== 'undefined') {
          if (failedKeys[apiKey]) {
            delete failedKeys[apiKey];
            localStorage.setItem('ai_novel_failed_keys', JSON.stringify(failedKeys));
          }
          // 更新当前密钥索引到下一个（为下次请求做准备）
          const nextPos = (pos + 1) % sortedIndices.length;
          const nextIndex = sortedIndices[nextPos];
          const savedSettings = JSON.parse(localStorage.getItem('ai_novel_settings') || '{}');
          savedSettings.currentKeyIndex = nextIndex;
          localStorage.setItem('ai_novel_settings', JSON.stringify(savedSettings));
        }
        return result.content;
      }
      
      // 记录错误
      errors.push(`密钥${keyIndex + 1}: ${result.error?.slice(0, 50)}...`);
      
      // 认证错误（401/403）标记到失败列表
      if (result.isAuthError && isFreeProvider && typeof window !== 'undefined') {
        failedKeys[apiKey] = Date.now();
        localStorage.setItem('ai_novel_failed_keys', JSON.stringify(failedKeys));
        console.warn(`密钥 ${keyIndex + 1} 认证失败，已标记冷却30分钟`);
      }
      
      // 如果不是认证错误，且不是免费提供商，直接抛出
      if (!result.isAuthError && !isFreeProvider) {
        throw new Error(result.error);
      }
      
      // 继续尝试下一个密钥
      console.warn(`密钥 ${keyIndex + 1} 失败，尝试下一个...`);
    }
    
    // 所有密钥都失败了
    throw new Error(`所有 API 密钥均失效:\n${errors.join('\n')}\n\n账户余额不足，请找小羊老师咨询。`);
  }
}

// 生成书名选项（新增）
export async function generateBookTitles(themes: string[], lengthType: string, settings: Settings, targetChapterCount?: number): Promise<Array<{title: string, intro: string}>> {
  const chapterCount = lengthType === 'custom'
    ? targetChapterCount || 100
    : LENGTHS.find(l => l.value === lengthType)?.count || 100;
  const lengthText = `${chapterCount}章`;
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  
  const prompt = `你是一位深谙爆款逻辑的网文主编。请根据以下主题，为一部${lengthText}的长篇小说构思 5 个极具吸引力、点击率极高的爆款书名。

${themePrompts}

【书名要求】（非常重要！）
1. 必须符合当前网文平台的爆款风格（如：情绪拉扯、极致反转、打脸虐渣、猎奇悬疑等）。
2. 书名要有强烈的画面感、反差感或悬念，能瞬间抓住读者的眼球。
3. 句式参考（不限于）：
   - 第一人称自述式（例：《我死后，渣男他疯了》、《给京圈太子爷当替身的第三年》）
   - 强反差/打脸式（例：《真千金回归后，全家跪求原谅》、《被辞退后，我成了前老板的顶头上司》）
   - 悬念/规则式（例：《规则怪谈：不要在半夜照镜子》、《我的老公每天都在换脸》）
   - 修仙/玄幻式（例：《开局签到混沌体》、《我在异界当剑仙》）
4. 书名字数控制在 5-15 字之间，语言要接地气、有网感。

【介绍要求】
每个书名需要配一句话介绍（15-30字），简要说明故事核心卖点或主角设定，吸引读者点击。

请严格以 JSON 格式返回一个对象，包含一个 \`titles\` 字段，其值为对象数组。每个对象包含：
- title (字符串): 书名
- intro (字符串): 一句话介绍（15-30字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  const titles = validateBookTitles(data);
  if (titles.length === 0) {
    throw new Error('AI 返回的书名选项为空或字段不完整，请重试。');
  }
  return titles;
}

// LENGTHS 常量定义（用于上面的函数）
const LENGTHS = [
  { label: '短篇 (100章)', value: '100', count: 100 },
  { label: '中短篇 (200章)', value: '200', count: 200 },
  { label: '中篇 (300章)', value: '300', count: 300 },
  { label: '中长篇 (400章)', value: '400', count: 400 },
  { label: '长篇 (500章)', value: '500', count: 500 },
  { label: '自定义', value: 'custom', count: 100 },
];

export async function generateBookInfo(currentBookInfo: BookInfo, settings: Settings): Promise<Partial<BookInfo>> {
  const lengthText = `${currentBookInfo.targetChapterCount}章`;
  
  let existingInfo = '';
  if (currentBookInfo.title) existingInfo += `\n已有书名：${currentBookInfo.title}`;
  if (currentBookInfo.outline) existingInfo += `\n已有大纲：${currentBookInfo.outline}`;
  if (currentBookInfo.worldbuilding) existingInfo += `\n已有世界观：${currentBookInfo.worldbuilding}`;

  const themePrompts = currentBookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  let prompt = `请帮我构思或完善一本小说设定。
【基本设定】
书名：${currentBookInfo.title}
${themePrompts}
篇幅：${lengthText}${existingInfo ? `\n\n【已有内容参考】\n请基于以下已有内容进行扩写、润色或补充，绝对不要完全推翻重写：${existingInfo}` : ''}

【重要】请基于书名《${currentBookInfo.title}》生成完整的故事大纲和世界观设定：
1. 故事大纲（outline）：约300字，包含故事背景、主角设定、核心冲突、主要剧情发展、结局方向
2. 世界观设定（worldbuilding）：约200字，包含世界背景、力量体系、社会结构、特殊设定等

请严格以 JSON 格式返回一个对象，必须包含以下三个字段：
{
  "title": "书名（保持原书名）",
  "outline": "故事大纲（约300字）",
  "worldbuilding": "世界观设定（约200字）"
}

注意：
- 三个字段都必须填写，不能为空
- outline 和 worldbuilding 必须是不同的内容，不要重复
- 不要输出其他任何解释性文字，只返回 JSON 对象`;

  prompt += promptOverrideSuffix(settings, 'bookInfo');
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);

  // 确保返回的数据包含所有必要字段
  // 确保返回的数据包含所有必要字段
  const result = {
    title: data.title || currentBookInfo.title,
    outline: data.outline || currentBookInfo.outline || '',
    worldbuilding: data.worldbuilding || data.worldBuilding || data.world_building || currentBookInfo.worldbuilding || ''
  };
  
  // 如果世界观仍然为空，给出警告
  if (!result.worldbuilding) {
    console.warn('警告：AI 未返回世界观设定，返回的数据:', data);
  }
  
  return result;
}

export async function generateCharacters(bookInfo: BookInfo, settings: Settings): Promise<Character[]> {
  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  let prompt = `根据以下小说设定，生成 8-15 个主要人物及其关系。
【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

请严格以 JSON 格式返回一个对象，包含一个 \`characters\` 字段，其值为数组。数组中每个对象包含以下字段：
- id (字符串): 唯一标识，如 'char1'
- name (字符串): 角色姓名
- role (字符串): 角色定位（如'主角'、'反派'、'导师'、'挚友'、'红颜知己'、'宿敌'、'亲人'、'神秘人物'等）
- description (字符串): 包含性格、背景、与其他人的关系、在剧情中的作用（约100字）

注意：
1. 人物数量尽可能多（8-15个），确保剧情有足够的角色互动和铺垫空间。
2. 配角要有鲜明个性，能在不同剧情阶段起到关键推动作用。
3. 人物之间应有复杂的关系网络，包括亲情、友情、爱情、师徒、恩怨、竞争等。
不要输出其他任何解释性文字。`;

  prompt += promptOverrideSuffix(settings, 'characters');
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return validateCharacters(data);
}

// 生成境界体系
export async function generateRealms(bookInfo: BookInfo, characters: Character[], settings: Settings): Promise<Realm[]> {
  const protagonist = characters.find(c => c.role === '主角');
  const protagonistName = protagonist?.name || '主角';
  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');

  const themesJoined = (bookInfo.themes || []).join(' ');
  const isCultivation = /玄幻|修仙|仙侠|高武|洪荒|灵气|武道|武侠|奇幻/.test(themesJoined);
  const isUrban = /都市|言情|悬疑|推理|规则怪谈|职场|校园|甜宠|霸总|年代|种田|美食|综艺|现实/.test(themesJoined);
  const systemKind = isCultivation ? '修炼/力量境界体系' : (isUrban ? '世界规则 / 身份阶层 / 组织权限 / 怪谈规则体系（不要硬套修仙境界）' : '力量等级或世界规则体系');
  const prompt = `根据以下小说设定，生成一套完整的${systemKind}。

【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}
主角：${protagonistName}

要求：
1. 大阶数量：8-12个从低到高排列（都市/悬疑题材可用 5-8 阶身份/组织/规则层级）。
2. 每个大境界包含小境界，必须符合网文惯例，只允许以下两种风格（全书统一选一种）：
   - 重数制：一重、二重、三重、四重、五重、六重、七重、八重、九重（共9个小境界，适合修仙/玄幻）
   - 三层制：初期、中期、后期（共3个小境界，适合都市/异能/简洁体系）
   不要自创其他小境界名称！
3. 每个大境界要有独特名称（符合世界观风格，如修仙用"炼气/筑基/金丹"，都市用"觉醒/C级/B级/A级/S级"，玄幻用"战士/战师/战王/战皇"等）。
4. 每个大境界简要描述特征和能力范围。
5. 每个大境界给出突破到下一大境界的条件（如需要什么资源、领悟、机缘等）。
6. 境界之间要有明确的实力差距感，高境界对低境界有碾压感。
7. 主角起始境界应在第1-2阶初期，最终达到最高或次高大境界巅峰。

请严格以 JSON 格式返回一个对象，包含一个 \`realms\` 字段，其值为数组。数组中每个对象包含以下字段：
- id (字符串): 唯一标识，如 'realm1'
- name (字符串): 大境界名称
- level (数字): 等级序号，从1开始
- description (字符串): 大境界特征描述（约30字）
- breakthroughCondition (字符串): 突破到下一大境界的条件（约30字，最高境界写"已至巅峰"）
- subRealms (数组): 小境界列表，每个对象包含：
  - name (字符串): 小境界名称（如"初期"）
  - description (字符串): 小境界简要描述（约15字）
不要输出其他任何解释性文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return validateRealms(data);
}

export async function generateTOC(
  bookInfo: BookInfo,
  characters: Character[],
  settings: Settings,
  startIndex: number,
  batchSize: number = 20,
  existingTitles: string[] = [],
  existingSummaries: string[] = []
): Promise<TOCItem[]> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  const endIndex = Math.min(startIndex + batchSize - 1, bookInfo.targetChapterCount);
  
  const existingSummariesStr = existingSummaries.length > 0
    ? `\n【已有章节剧情摘要（禁止复述相近推进）】\n${existingSummaries.slice(-40).map((s, i) => `${i + 1}. ${s.slice(0, 80)}`).join('\n')}`
    : '';
  const existingTitlesStr = existingTitles.length > 0 
    ? `\n【已生成的章节标题（请务必避免重复）】\n${existingTitles.join(' | ')}\n` 
    : '';

  const progressPercentage = Math.round((endIndex / bookInfo.targetChapterCount) * 100);
  const remainingChapters = bookInfo.targetChapterCount - endIndex;
  const closingTitleStart = getClosingTitleStart(bookInfo.targetChapterCount);
  
  let pacingInstruction = '';
  if (endIndex === bookInfo.targetChapterCount) {
    pacingInstruction = `【🚨 完结红色警告 🚨】
当前正在生成全书的最后 ${endIndex - startIndex + 1} 章大纲（第 ${startIndex} 章至第 ${endIndex} 章）。
注意：第 ${endIndex} 章就是全书的【最终大结局】！
请务必在本批次大纲中：
1. 彻底解决所有核心冲突，填平所有伏笔。
2. 第 ${endIndex} 章必须是真正的大结局，给故事画上圆满句号。
3. 绝对、绝对不要再引入任何新人物、新矛盾或新剧情分支！`;
  } else if (remainingChapters <= 10) {
    pacingInstruction = `【⚠️ 终局收网阶段 ⚠️】
距离全书完结（第 ${bookInfo.targetChapterCount} 章）仅剩最后 ${remainingChapters} 章！
请开始全面收网，解决次要矛盾，将所有线索和角色汇聚向最终决战或大结局。切忌再展开新地图或新剧情！`;
  } else if (progressPercentage >= 60) {
    pacingInstruction = `【🔥 剧情高潮阶段 🔥】
当前进度约 ${progressPercentage}%。请围绕大纲展开核心冲突，安排高潮事件，深化人物关系，剧情节奏加快。`;
  } else {
    pacingInstruction = `【🌱 剧情铺垫/发展阶段 🌱】
当前进度约 ${progressPercentage}%。请稳步推进剧情，铺陈世界观，引出核心矛盾，设置悬念，吸引读者。`;
  }

  const themePrompts = bookInfo.themes.map(theme => getThemePrompt(theme, 'novel')).join('\n');
  const prompt = `根据以下小说设定和人物，生成第 ${startIndex} 章到第 ${endIndex} 章的目录大纲。
【书籍信息】
书名：${bookInfo.title}
${themePrompts}
大纲：${bookInfo.outline}
【主要人物】
${charsStr}${existingTitlesStr}${existingSummariesStr}
${pacingInstruction}

【章节标题节奏硬性规则】
1. 第 ${closingTitleStart} 章之前，标题禁止出现“大结局、最终章、终章、尾声、完结、终局、最终、最后一战、最后的决战、落幕、归宿、终点、终焉、谢幕、尘埃落定、一切终结”等结局性词汇。
2. “大结局、最终章、终章、尾声、完结、结局篇、全书终”只能用于第 ${bookInfo.targetChapterCount} 章，其他章节绝对不能使用。
3. 早中期标题要体现阶段冲突、转折、线索或人物行动，不要提前剧透最终胜负或故事收束。

请严格以 JSON 格式返回一个对象，包含一个 \`chapters\` 字段，其值为数组。数组中每个对象包含以下字段：
- chapterNumber (数字): 章节序号（必须从 ${startIndex} 到 ${endIndex}）
- title (字符串): 章节标题（必须新颖，绝对不能与已生成的章节标题重复）
- summary (字符串): 本章详细剧情摘要（约100-150字，必须推进新事件，禁止与已有章节摘要高度相似或复述同一线索）
不要输出其他任何解释性文字。`;

  const expectedCount = endIndex - startIndex + 1;
  let merged: TOCItem[] = [];
  let titlesPool = [...existingTitles];
  let summaryPool = [...existingSummaries];
  const allSanitized: string[] = [];
  const maxAttempts = 3;

  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const missing: number[] = [];
    for (let n = startIndex; n <= endIndex; n++) {
      if (!merged.some(c => c.chapterNumber === n)) missing.push(n);
    }
    if (missing.length === 0) break;

    // 首轮用全批 prompt；后续只补缺号（缩小范围，避免整批重来）
    let attemptPrompt = prompt;
    if (attempt > 1) {
      const missStart = missing[0];
      const missEnd = missing[missing.length - 1];
      attemptPrompt = `请只补全以下缺失章节号的目录（不要输出已有章）：${missing.join('、')}。
范围提示：第 ${missStart}–${missEnd} 章附近。书名：${bookInfo.title}。
【硬性】第 ${getClosingTitleStart(bookInfo.targetChapterCount)} 章之前标题禁止结局性词汇（大结局/终章/尾声/完结/最后一战等）。
已有标题勿重复：${titlesPool.slice(-40).join(' | ')}
严格 JSON：{"chapters":[{"chapterNumber":n,"title":"...","summary":"100-150字"}]}`;
    }

    try {
      const responseText = await callAI(attemptPrompt + promptOverrideSuffix(settings, 'toc'), settings, true);
      const data = extractJSON(responseText);
      const batch = validateTOC(
        data,
        attempt === 1 ? startIndex : Math.min(...missing),
        attempt === 1 ? endIndex : Math.max(...missing),
        titlesPool,
        bookInfo.targetChapterCount,
        summaryPool
      );
      const notes = (batch as any).__sanitizedNotes as string[] | undefined;
      if (notes?.length) allSanitized.push(...notes);

      for (const ch of batch) {
        if (ch.chapterNumber < startIndex || ch.chapterNumber > endIndex) continue;
        if (merged.some(m => m.chapterNumber === ch.chapterNumber)) continue;
        merged.push(ch);
        titlesPool.push(ch.title);
        summaryPool.push(ch.summary);
      }
    } catch (e: any) {
      // 单次请求/解析失败：保留已 merge 的章节，继续尝试或返回部分结果
      lastError = e?.message || String(e);
      console.warn(`generateTOC attempt ${attempt} failed, keep ${merged.length} chapters:`, lastError);
      if (merged.length > 0) {
        // 已有成果则不再无意义重试整批推倒，仅再补缺一轮
        continue;
      }
      if (attempt === maxAttempts) break;
    }
  }

  merged = merged.sort((a, b) => a.chapterNumber - b.chapterNumber);
  if (merged.length === 0) {
    throw new Error(
      lastError
        ? `目录生成本批未收下任何章：${lastError}。已有目录不会被清空，请重试。`
        : 'AI 返回的目录全部无效（空/重复/摘要撞车），请重试本批。已生成的目录不会被清空。'
    );
  }

  // 把软改写说明挂到结果上，供 UI toast（不阻断）
  (merged as any).__sanitizedNotes = allSanitized;
  (merged as any).__partial =
    merged.length < expectedCount
      ? `本批期望 ${expectedCount} 章，已收下 ${merged.length} 章（缺号可再点「继续生成/补缺目录」补齐）`
      : '';
  if (lastError && merged.length < expectedCount) {
    (merged as any).__partial += `；中途有一次请求失败已忽略`;
  }
  return merged;
}

export async function generateChapterContent(
  bookInfo: BookInfo,
  characters: Character[],
  tocItem: TOCItem,
  previousChapters: string[],
  settings: Settings,
  toc: TOCItem[],
  realmProgress?: RealmProgress,
  novelMemory?: NovelMemory,
  genOpts?: ChapterGenOptions
): Promise<string> {
  const charsStr = characters.map(c => `- ${c.name} (${c.role}): ${c.description}`).join('\n');
  
  const isFinalChapter = tocItem.chapterNumber === bookInfo.targetChapterCount;
  const remainingChapters = bookInfo.targetChapterCount - tocItem.chapterNumber;
  
  // 计算当前进度百分比
  const progressPercent = Math.round((tocItem.chapterNumber / bookInfo.targetChapterCount) * 100);

  const styleBlock = genOpts?.styleDirective?.trim()
    ? `\n【写作风格（用户指定）】\n${genOpts.styleDirective.trim()}\n`
    : '';
  const entityBlock = genOpts?.entityContext?.trim()
    ? `\n【本章相关设定卡】\n${genOpts.entityContext.trim()}\n设定卡与本章剧情相关时自然体现，不要生硬罗列。\n`
    : '';
  
  let pacingContext = '';
  if (isFinalChapter) {
    pacingContext = `【🚨 完结红色警告 🚨】本章是全书的最后一章（第 ${bookInfo.targetChapterCount} 章）！请务必给故事画上一个完整的句号，解决所有悬念，绝对不要在结尾留悬念或断章。`;
  } else if (remainingChapters <= 5) {
    pacingContext = `【⚠️ 终局收网阶段 ⚠️】本章是第 ${tocItem.chapterNumber} 章，距离全书大结局（第 ${bookInfo.targetChapterCount} 章）仅剩 ${remainingChapters} 章！请注意收拢剧情，不要再挖新坑，将故事推向最终高潮。`;
  } else {
    pacingContext = `当前是第 ${tocItem.chapterNumber} 章（全书${bookInfo.targetChapterCount}章，进度${progressPercent}%）。请稳步推进剧情。`;
  }

  let prompt = `你是一位专业网文作家。撰写第 ${tocItem.chapterNumber} 章：${tocItem.title}。

${pacingContext}

【核心要求】
1. 本章目标字数严格控制在${settings.minWordCount}字左右（误差不超过±10%），严禁超写！
2. 紧扣摘要推进剧情，直接输出正文，不要标题/问候/总结/解释。
3. 章节之间必须有自然过渡，使用场景切换、时间跳跃、人物动作等方式平滑衔接。
4. 写作风格自然流畅，可以包含任何符合剧情需要的内容，不受限制。

【书籍信息】
书名：${bookInfo.title}
主题：${bookInfo.themes.join('、')}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

【人物设定】
${charsStr}
${styleBlock}${entityBlock}
${novelMemory ? `\n【全书记忆】\n故事进展：${novelMemory.storySoFar || '暂无'}\n人物状态：${novelMemory.characterStates || '暂无'}\n未回收伏笔：${novelMemory.openThreads.join('；') || '暂无'}\n已解决线索：${novelMemory.resolvedThreads.join('；') || '暂无'}\n重要物品/设定：${novelMemory.importantItems.join('；') || '暂无'}\n请严格延续这些状态，不要让角色关系、伏笔、物品归属和已发生事件前后矛盾。\n` : ''}
${realmProgress && realmProgress.realms.length > 0 ? (() => {
  // 根据chapterRealmMap自动推算当前章节主角所在境界（大境界+小境界）
  let currentRealmIdx = 0;
  let currentSubIdx = 0;
  const sortedBreakpoints = Object.entries(realmProgress.chapterRealmMap)
    .map(([ch, val]) => ({ ch: Number(ch), realmIndex: (val as any).realmIndex ?? val, subRealmIndex: (val as any).subRealmIndex ?? 0 }))
    .sort((a, b) => a.ch - b.ch);
  for (const bp of sortedBreakpoints) {
    if (bp.ch <= tocItem.chapterNumber) {
      currentRealmIdx = bp.realmIndex;
      currentSubIdx = bp.subRealmIndex;
    } else {
      break;
    }
  }
  const currentRealm = realmProgress.realms[currentRealmIdx];
  const currentSubRealm = currentRealm?.subRealms?.[currentSubIdx];
  const isBreakthrough = realmProgress.chapterRealmMap[tocItem.chapterNumber] !== undefined;
  const bpData = realmProgress.chapterRealmMap[tocItem.chapterNumber] as any;
  const nextRealm = currentRealmIdx < realmProgress.realms.length - 1 ? realmProgress.realms[currentRealmIdx + 1] : null;
  const nextSubRealm = currentSubIdx < (currentRealm?.subRealms?.length || 1) - 1 ? currentRealm?.subRealms?.[currentSubIdx + 1] : null;
  const protagonist = characters.find(c => c.role === '主角');
  const protagName = protagonist?.name || '主角';
  const realmList = realmProgress.realms.map((r, i) => {
    const isCurrent = i === currentRealmIdx;
    const subStr = r.subRealms?.map((s, si) => `${isCurrent && si === currentSubIdx ? '▶' : '○'}${s.name}`).join(' ') || '';
    return `${isCurrent ? '▶' : '○'} ${r.level}. ${r.name} ${subStr}`;
  }).join('\n');
  // 判断突破类型
  let breakthroughHint = '';
  if (isBreakthrough) {
    const isBigBreakthrough = bpData?.subRealmIndex === 0 && bpData?.realmIndex > 0; // 进入新大境界
    if (isBigBreakthrough) {
      const prevRealm = realmProgress.realms[(bpData.realmIndex as number) - 1];
      breakthroughHint = `⚠️ 本章主角大境界突破！${prevRealm?.name || '初始'} → ${currentRealm.name}！必须写出震撼的突破过程（天象异变/灵力暴涌/战斗中突破），突破后实力碾压同阶，展示全新能力。`;
    } else {
      breakthroughHint = `⚠️ 本章主角小境界提升→${currentSubRealm?.name || ''}！写出修炼感悟/瓶颈突破的过程，实力小幅提升，为后续大境界突破蓄势。`;
    }
  }
  const fullRealmName = currentSubRealm ? `${currentRealm.name}·${currentSubRealm.name}` : currentRealm?.name || '未知';
  const nextFullRealm = nextSubRealm ? `${currentRealm.name}·${nextSubRealm.name}` : (nextRealm ? `${nextRealm.name}·${nextRealm.subRealms?.[0]?.name || ''}` : null);
  return `\n【境界体系】主角${protagName}当前境界：${fullRealmName}（第${currentRealm?.level || '?'}阶）
${nextFullRealm ? `下一阶段：${nextFullRealm}${nextRealm && !nextSubRealm ? `（大境界突破条件：${nextRealm.breakthroughCondition}）` : ''}` : '已至巅峰！'}
境界全览：
${realmList}
${breakthroughHint}
【境界贯穿要求】境界需自然融入正文，约20-30章提及1次即可，不要每章都提。提及方式：
1. 战斗/对决时：用境界名描述实力差距（"区区${currentRealm?.name}也敢拦我"），或展示境界特有能力。
2. 修炼/突破时：写修炼场景，感悟瓶颈，正常修炼突破也可以，不必每次都靠战斗突破。
3. 遇强敌时：被高境界碾压的无力感，为后续突破蓄势。
4. 旁人评价：他人议论主角境界变化，侧面烘托。
不要生硬插入，用对话/旁白/心理活动自然带出。非提及章节正常写剧情即可，不需要刻意提境界。`;
})() : ''}

【本章摘要】
${tocItem.summary}
`;

  if (previousChapters.length > 0) {
    // 分级上下文：近章全文保证衔接，中程摘要维持长线，全书记忆兜底设定
    const nums = genOpts?.previousChapterNumbers
      && genOpts.previousChapterNumbers.length === previousChapters.length
      ? genOpts.previousChapterNumbers
      : previousChapters.map((_, i) => tocItem.chapterNumber - previousChapters.length + i);
    const nearCount = Math.min(3, previousChapters.length);
    const nearStart = previousChapters.length - nearCount;
    const nearParts: string[] = [];
    for (let i = nearStart; i < previousChapters.length; i++) {
      const raw = previousChapters[i] || '';
      const clipped = raw.length > 1800
        ? `${raw.slice(0, 300)}\n……（中略）……\n${raw.slice(-1400)}`
        : raw;
      nearParts.push(`--- 第${nums[i]}章全文 ---\n${clipped}`);
    }
    prompt += `\n【上文·近章全文】以下是最多3章近期正文，请保证无缝衔接：\n${nearParts.join('\n')}\n`;

    const recentWindow = toc.filter(t => t.chapterNumber < tocItem.chapterNumber).slice(-12);
    const midToc = recentWindow.slice(0, Math.max(0, recentWindow.length - 3));
    if (midToc.length > 0) {
      prompt += `\n【上文·中程摘要】\n${midToc.map(t => `第${t.chapterNumber}章：${t.summary}`).join('\n')}\n`;
    }

    prompt += `\n为了保证章节之间的自然衔接，以下是上一章结尾的部分正文，请**直接顺着上一章的结尾继续往下写**，不要重复上一章的内容：\n`;
    const lastChapter = previousChapters[previousChapters.length - 1];
    prompt += `--- 上一章结尾 ---\n...${lastChapter.slice(-500)}\n`;
  }

  const mode = genOpts?.mode || 'write';
  const existing = (genOpts?.existingContent || '').trim();
  if (mode === 'continue' && existing) {
    prompt += `\n\n【任务：续写】\n以下是本章已有正文，请从结尾自然续写，不要重复已有内容。优先输出完整可读的一章。\n--- 已有正文（尾部） ---\n${existing.slice(-2500)}\n`;
  } else if (mode === 'expand' && existing) {
    prompt += `\n\n【任务：扩写】\n在保持剧情与人设不变的前提下丰富细节与对话，直接输出扩写后的完整本章正文。\n--- 原文 ---\n${existing}\n`;
  } else if (mode === 'conclude' && existing) {
    prompt += `\n\n【任务：收束本章】\n在已有正文基础上完成本章收束，解决本章冲突，不要新开超大主线。直接输出完整本章正文。\n--- 原文 ---\n${existing}\n`;
  } else if (mode === 'rewrite') {
    const dir = (genOpts?.directive || '').trim();
    prompt += `\n\n【任务：定向改写】\n按下列要求改写本章，保留主线与人物一致，直接输出完整正文。\n要求：${dir || '按本章摘要重写，提升连贯与文笔。'}\n`;
    if (existing) prompt += `--- 原文（可参考） ---\n${existing.slice(0, 4000)}\n`;
  }
  if (genOpts?.directive && mode !== 'rewrite') {
    prompt += `\n\n【额外要求】${genOpts.directive}\n`;
  }

  prompt += promptOverrideSuffix(settings, 'chapter');

  const responseText = await callAI(prompt, settings, false, {
    signal: genOpts?.signal,
    stream: !!genOpts?.onChunk,
    onChunk: genOpts?.onChunk,
  });
  return responseText.trim();
}

export async function updateNovelMemory(
  previousMemory: NovelMemory,
  bookInfo: BookInfo,
  tocItem: TOCItem,
  chapterContent: string,
  settings: Settings
): Promise<NovelMemory> {
  const prompt = `你是小说长线连续性编辑。请根据当前章节，更新全书记忆，帮助后续章节保持设定一致。

【书籍信息】
书名：${bookInfo.title}
总大纲：${bookInfo.outline}

【原有全书记忆】
故事进展：${previousMemory.storySoFar || '暂无'}
人物状态：${previousMemory.characterStates || '暂无'}
未回收伏笔：${previousMemory.openThreads.join('；') || '暂无'}
已解决线索：${previousMemory.resolvedThreads.join('；') || '暂无'}
重要物品/设定：${previousMemory.importantItems.join('；') || '暂无'}

【新章节】
第${tocItem.chapterNumber}章 ${tocItem.title}
章节摘要：${tocItem.summary}
章节正文：
${chapterContent.slice(0, 6000)}

请严格返回 JSON 对象：
{
  "storySoFar": "用300字以内概括截至本章的主线进展",
  "characterStates": "用300字以内记录主要人物当前关系、立场、伤势、目标、情绪变化",
  "openThreads": ["仍未解决的伏笔/矛盾/承诺，最多10条"],
  "resolvedThreads": ["本章已经解决或兑现的线索，最多10条"],
  "importantItems": ["重要物品、能力、地点、组织和设定状态，最多10条"],
  "lastUpdatedChapter": ${tocItem.chapterNumber}
}
不要输出其他文字。`;

  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return {
    storySoFar: cleanText(data.storySoFar).slice(0, 600),
    characterStates: cleanText(data.characterStates).slice(0, 600),
    openThreads: Array.isArray(data.openThreads) ? data.openThreads.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.openThreads,
    resolvedThreads: Array.isArray(data.resolvedThreads) ? data.resolvedThreads.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.resolvedThreads,
    importantItems: Array.isArray(data.importantItems) ? data.importantItems.map(cleanText).filter(Boolean).slice(0, 10) : previousMemory.importantItems,
    lastUpdatedChapter: Number(data.lastUpdatedChapter) || tocItem.chapterNumber,
  };
}

export async function generateShortStoryTitles(themes: string[], settings: Settings): Promise<string[]> {
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一位深谙爆款逻辑的网文主编。请根据以下主题，为一篇7k-12k字的短篇小说构思 5 个极具吸引力、点击率极高的爆款标题。

${themePrompts}

【标题要求】（非常重要！）
1. 必须符合当前番茄小说、知乎等平台的短篇爆款风格（如：情绪拉扯、极致反转、打脸虐渣、猎奇悬疑等）。
2. 标题要有强烈的画面感、反差感或悬念，能瞬间抓住读者的眼球，让人产生强烈的点击欲望。
3. 句式参考（不限于）：
   - 第一人称自述式（例：《我死后，渣男他疯了》、《给京圈太子爷当替身的第三年》）
   - 强反差/打脸式（例：《真千金回归后，全家跪求原谅》、《被辞退后，我成了前老板的顶头上司》）
   - 悬念/规则式（例：《规则怪谈：不要在半夜照镜子》、《我的老公每天都在换脸》）
4. 标题字数控制在 8-20 字之间，语言要接地气、有网感。

请严格以 JSON 格式返回一个对象，包含一个 \`titles\` 字段，其值为字符串数组。不要输出其他任何解释性文字。`;
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  return data.titles || [];
}

export async function generateShortStoryOutlineFromTitle(title: string, themes: string[], settings: Settings): Promise<string> {
  const themePrompts = themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一位顶尖的短篇小说作家。请根据以下标题和主题，构思一个短篇故事（约7k-12k字）的核心脑洞和详细大纲。
标题：${title}
${themePrompts}

要求：
1. 包含故事背景、主要人物简介、起因、发展、高潮、结局。
2. 剧情要有张力，符合所选主题。
3. 直接输出大纲文本，不需要 JSON 格式。`;
  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

// 生成分段大纲
export async function generateShortStorySegments(
  info: ShortStoryInfo,
  settings: Settings
): Promise<StorySegment[]> {
  const themePrompts = info.themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  const prompt = `你是一个专业的小说结构规划师。

请为以下短篇故事设计分段大纲，将故事拆分成3-5个逻辑连贯的部分。

故事标题：${info.title || '未命名'}
${themePrompts}
目标字数：${info.targetWordCount}字
用户核心脑洞/已有大纲：${info.outline || '暂无，请根据标题和主题原创设计'}

要求：
1. 每个部分应该有独立的标题（如：开端、发展、高潮、结局等）
2. 每个部分标明预估字数（总字数接近${info.targetWordCount}）
3. 每个部分提供内容摘要，说明这部分要讲述什么
4. 确保各部分逻辑连贯，形成完整故事

请以JSON数组格式返回：
[
  {
    "segmentNumber": 1,
    "title": "第一部分标题",
    "wordCount": 800,
    "summary": "这部分的内容摘要..."
  },
  ...
]`;

  const response = await callAI(prompt, settings, true);
  const segments = extractJSON(response);
  return validateSegments(segments, info.targetWordCount);
}

// 生成指定分段内容
export async function generateShortStoryContent(
  info: ShortStoryInfo,
  existingContent: string,
  settings: Settings,
  isFinalBatch: boolean = false,
  segmentIndex?: number
): Promise<string> {
  // 构建当前要写的分段说明
  const segments = info.segments || [];
  const totalSegments = segments.length || 1;
  const currentBatch = typeof segmentIndex === 'number' ? segmentIndex : (info.currentSegment || 0);
  const currentSeg = segments[currentBatch];
  const segmentsInfo = segments.map((s, i) => 
    `第${i+1}段：${s.title}（约${s.wordCount}字）- ${s.summary}${s.isGenerated ? ' [已生成]' : ''}${i === currentBatch ? ' 【当前要写】' : ''}`
  ).join('\n') || '当前没有分段规划，将按连续写作模式推进。';
  
  // 按分段字数；无分段时回退两批
  const targetTotal = info.targetWordCount || 10000;
  const batchWordCount = currentSeg?.wordCount
    ? currentSeg.wordCount
    : Math.round(targetTotal / Math.max(totalSegments, 2));
  
  const endingInstruction = isFinalBatch 
    ? `【最后一段/收尾：目标约${batchWordCount}字】必须写到真正大结局！所有线索收束，主角目标达成或失败，用具体动作/对话收尾，禁止悬念钩子！`
    : (currentSeg
      ? `【当前段：${currentSeg.title} · 目标约${batchWordCount}字】只写本段内容：${currentSeg.summary}。充分展开细节，在本段结束处自然停下，不要提前写后续段。`
      : `【连续写作：目标约${batchWordCount}字】当前没有分段规划，这是同一篇正文的续写批次。承接前文推进新的剧情，充分展开细节，在合适的剧情节点暂停，不要重复前文，也不要提前收尾。`);

  const themePrompts = info.themes.map(theme => getThemePrompt(theme, 'shortStory')).join('\n');
  let prompt = `你是一位专业短篇小说作家。撰写短篇故事。

【故事设定】
标题：${info.title}
${themePrompts}
目标总字数：约${targetTotal}字（按分段逐段生成，本段约${batchWordCount}字）
核心脑洞/大纲：${info.outline}

【分段规划】（共${totalSegments}段，当前第${currentBatch+1}段）
${segmentsInfo}

${endingInstruction}

【要求】
1. 本段目标严格控制在${batchWordCount}字左右（误差不超过±15%），严禁超写到下一段！
2. 直接输出正文，不要标题/问候/总结/解释。
3. ${isFinalBatch ? '这是最后一段，必须写完真正大结局，所有伏笔回收，用具体动作/对话收尾！' : '只完成本段，不要写结局（除非本段本身就是结局）。'}
4. 写作风格自然流畅，可以包含任何符合剧情需要的内容，不受限制。
${isFinalBatch ? '\n【强制结尾要求】这是最后一段生成！必须：1)所有核心冲突解决 2)主角目标达成或明确失败 3)所有伏笔回收 4)用具体动作/对话收尾 5)禁止\"真正风暴才刚开始\"等万能句 6)禁止\"风卷起纸页慢慢翻开\"等悬念钩子！' : ''}
`

  if (existingContent) {
    const recentContent = existingContent.slice(-1500);
    const totalLength = existingContent.length;
    prompt += `\n【前文回顾】\n以下是你已经写出的前文最后部分（全文约${Math.round(totalLength / 2)}字，请勿重复已写内容），请紧接其后继续撰写新内容：\n\n${recentContent}\n\n【重要提醒】你正在续写第${Math.floor(totalLength / 1500) + 1}部分内容。绝对不要重复上文已出现的对话、场景描写或情节，必须推进新的剧情发展。`;
  }

  prompt += promptOverrideSuffix(settings, 'shortContent');

  const responseText = await callAI(prompt, settings, false);
  return responseText.trim();
}

// ===== 风格工坊 / 设定库 / 修复流 =====

export async function extractStyleCard(
  excerpt: string,
  settings: Settings
): Promise<{ traits: string }> {
  const prompt = `你是资深网文编辑。分析以下范文的写作风格，输出一张"风格特征卡"，供另一个 AI 模仿写作时使用。

【范文样本】
${excerpt.slice(0, 6000)}

请严格返回 JSON 对象：
{
  "traits": "用150字以内概括：叙事视角、句式节奏、对话密度、情绪渲染方式、爽点/钩子手法、用词偏好。要具体可执行，不要空话"
}
不要输出其他任何解释性文字。`;
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  const traits = cleanText(data.traits);
  if (!traits) throw new Error('AI 未返回有效的风格特征，请重试或更换范文。');
  return { traits: traits.slice(0, 600) };
}

export async function extractEntityCards(
  bookInfo: BookInfo,
  settings: Settings
): Promise<Array<{ name: string; type: string; description: string; keywords: string[] }>> {
  const prompt = `你是小说设定整理师。根据以下书籍信息，提取需要跨章保持一致的实体设定卡。

【书籍信息】
书名：${bookInfo.title}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

要求：
1. 提取地点、物品/法宝、势力/组织、伏笔/约定等（不要提取已单独管理的人物）。
2. 每张卡：name（名称）、type（只能是 location/item/faction/thread 之一）、description（60字内，含当前状态）、keywords（2-5个触发词，出现在章节摘要中才注入）。
3. 最多 12 张，按重要性排序。

请严格返回 JSON 对象：{"cards":[...]}。不要输出其他文字。`;
  const responseText = await callAI(prompt + promptOverrideSuffix(settings, 'bookInfo'), settings, true);
  const data = extractJSON(responseText);
  const raw = ensureArray(data.cards, 'cards');
  const validTypes = ['location', 'item', 'faction', 'thread'];
  return raw
    .map((c: any) => ({
      name: cleanText(c.name).slice(0, 30),
      type: validTypes.includes(c.type) ? c.type : 'item',
      description: cleanText(c.description).slice(0, 200),
      keywords: Array.isArray(c.keywords) ? c.keywords.map(cleanText).filter(Boolean).slice(0, 5) : [],
    }))
    .filter(c => c.name);
}

export async function analyzeOutlineRepair(
  newBookInfo: BookInfo,
  toc: TOCItem[],
  field: 'outline' | 'worldbuilding',
  settings: Settings
): Promise<Array<{ chapterNumber: number; reason: string }>> {
  const tocStr = toc
    .map(t => `第${t.chapterNumber}章 ${t.title}：${t.summary}`)
    .join('\n')
    .slice(0, 6000);
  const fieldName = field === 'outline' ? '故事大纲' : '世界观设定';
  const prompt = `你是连载小说连续性主编。作者刚修改了${fieldName}，需要判断哪些已生成章节与最新设定冲突、正文必须修改。

【最新${fieldName}】
${field === 'outline' ? newBookInfo.outline : newBookInfo.worldbuilding}
（另一项设定供参考——大纲：${newBookInfo.outline.slice(0, 500)}；世界观：${newBookInfo.worldbuilding.slice(0, 500)}）

【已有章节目录】
${tocStr || '（暂无目录）'}

要求：
1. 只列与最新${fieldName}明确冲突、或必须调整才能衔接后续剧情的章节。
2. 每章给一句可执行的修改原因（reason），如"主角身份已改为孤儿，需删去世家子弟描写"。
3. 最多 12 章，按章节号升序；没有冲突就返回空数组。

请严格返回 JSON 对象：{"repairs":[{"chapterNumber":1,"reason":"..."}]}。不要输出其他文字。`;
  const responseText = await callAI(prompt, settings, true);
  const data = extractJSON(responseText);
  const raw = ensureArray(data.repairs, 'repairs');
  return raw
    .map((r: any) => ({
      chapterNumber: Number(r.chapterNumber),
      reason: cleanText(r.reason).slice(0, 200),
    }))
    .filter(r => r.chapterNumber >= 1 && r.reason)
    .sort((a, b) => a.chapterNumber - b.chapterNumber)
    .slice(0, 12);
}

export async function repairChapterContent(
  bookInfo: BookInfo,
  tocItem: TOCItem,
  chapterContent: string,
  reason: string,
  settings: Settings
): Promise<string> {
  const prompt = `你是网文修订作者。作者修改了书籍设定，需要你修订本章正文，使它与最新设定一致。

【最新书籍设定】
书名：${bookInfo.title}
大纲：${bookInfo.outline}
世界观：${bookInfo.worldbuilding}

【本章信息】
第${tocItem.chapterNumber}章 ${tocItem.title}
本章摘要：${tocItem.summary}

【需要修复的问题】
${reason}

【修订规则】
1. 只修复与上述问题相关的部分，其余剧情、对话、细节尽量原样保留。
2. 修复后正文必须能无缝衔接前后章节，字数与原文相当。
3. 直接输出修订后的完整本章正文，不要标题、解释或对比说明。

【本章原文】
${chapterContent.slice(0, 8000)}`;
  const responseText = await callAI(prompt + promptOverrideSuffix(settings, 'chapter'), settings, false);
  const result = responseText.trim();
  if (!result) throw new Error('AI 返回的修复正文为空，请重试。');
  return result;
}

export const __test__ = {
  extractJSON,
  validateBookTitles,
  validateCharacters,
  validateTOC,
  validateSegments,
};
