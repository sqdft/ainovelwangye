import type { Settings } from '../types';

/** 设置是否足以发起生成请求（主路径体检） */
export function settingsReady(settings: Settings): { ok: boolean; reason?: string } {
  if (!settings) return { ok: false, reason: '未加载设置' };
  if (settings.provider === 'gemini') {
    // gemini 路径可能无 baseUrl 检测；仍要有 model
    if (!settings.model?.trim()) return { ok: false, reason: '请填写模型名称' };
    return { ok: true };
  }
  if (!settings.baseUrl?.trim()) return { ok: false, reason: '请先设置 Base URL' };
  const hasKey =
    !!(settings.apiKey && settings.apiKey.trim()) ||
    (Array.isArray(settings.apiKeys) && settings.apiKeys.some(k => !!k?.trim()));
  if (!hasKey && settings.provider !== 'kilo' && settings.provider !== 'ollama' as string) {
    return { ok: false, reason: '请先设置 API Key' };
  }
  if (!settings.model?.trim()) return { ok: false, reason: '请选择或填写模型' };
  return { ok: true };
}

export type DownstreamLevel = 'book' | 'toc' | 'chapters';

export function downstreamImpactLabel(level: DownstreamLevel): string {
  if (level === 'book') return '人物、境界/规则、目录、正文与全书记忆';
  if (level === 'toc') return '境界/规则、目录、正文与全书记忆';
  return '正文与全书记忆';
}
