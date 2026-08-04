import { Loader2, RefreshCw } from 'lucide-react';
import type { Provider, ProviderProfile, Settings } from '../../types';
import { PROVIDERS } from '../../config/providers';

export interface SettingsPanelProps {
  mode: 'novel' | 'shortStory';
  settings: Settings;
  setSettings: (value: Settings | ((prev: Settings) => Settings)) => void;
  isTaskBusy: boolean;
  isGenerating: boolean;
  providerProfiles: ProviderProfile[];
  activeProfileId: string | null;
  profileNameDraft: string;
  setProfileNameDraft: (v: string) => void;
  onActivateProfile: (p: ProviderProfile) => void;
  onDeleteProfile: (id: string) => void;
  onBeginNewProfile: () => void;
  onSaveProfile: (asNew?: boolean) => void;
  onProviderChange: (provider: Provider) => void;
  onDetectModels: () => void;
}

export function SettingsPanel({
  mode,
  settings,
  setSettings,
  isTaskBusy,
  isGenerating,
  providerProfiles,
  activeProfileId,
  profileNameDraft,
  setProfileNameDraft,
  onActivateProfile,
  onDeleteProfile,
  onBeginNewProfile,
  onSaveProfile,
  onProviderChange,
  onDetectModels,
}: SettingsPanelProps) {
  return (
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">供应商卡片</label>
              <span className="text-[11px] text-[var(--ui-muted)]">保存后可随时切换配置与模型</span>
            </div>
            {providerProfiles.length === 0 ? (
              <p className="text-xs text-[var(--ui-muted)] mb-2 ui-seed-tip">
                还没有卡片。点「＋ 添加新供应商」填配置，再「保存为新卡片」；可保存多套随时切换。
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {providerProfiles.map(p => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onActivateProfile(p)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onActivateProfile(p);
                      }
                    }}
                    className={`ui-provider-card text-left cursor-pointer ${
                      activeProfileId === p.id ? 'ui-provider-card-active' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--ui-ink)] truncate">{p.name}</div>
                        <div className="text-[11px] text-[var(--ui-muted)] mt-0.5 truncate">
                          {PROVIDERS[p.provider]?.label || p.provider} · {p.model || '未选模型'}
                        </div>
                      </div>
                      {activeProfileId === p.id && (
                        <span className="text-[10px] font-semibold text-[var(--ui-accent-text)] shrink-0">使用中</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="text-[11px] text-red-600 hover:underline"
                        onClick={e => {
                          e.stopPropagation();
                          if (confirm(`删除卡片「${p.name}」？`)) onDeleteProfile(p.id);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-2">
              <button type="button" onClick={onBeginNewProfile} className="ui-btn-secondary text-sm whitespace-nowrap">
                ＋ 添加新供应商
              </button>
              {!activeProfileId && (
                <span className="text-[11px] text-[var(--ui-muted)] self-center">当前为新建草稿，不会改动已有卡片</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-1">
              <input
                type="text"
                value={profileNameDraft}
                onChange={e => setProfileNameDraft(e.target.value)}
                placeholder="卡片名称，如：日日新 / 商汤 DeepSeek"
                className="flex-1 ui-input"
              />
              <button
                type="button"
                onClick={() => onSaveProfile(false)}
                disabled={!activeProfileId}
                className="ui-btn-primary text-sm whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
                title={!activeProfileId ? '新建时请用「保存为新卡片」' : '把下方表单写回当前使用中的卡片'}
              >
                更新当前卡片
              </button>
              <button type="button" onClick={() => onSaveProfile(true)} className="ui-btn-secondary text-sm whitespace-nowrap">
                保存为新卡片
              </button>
            </div>
            <p className="text-[11px] text-[var(--ui-muted)] mb-1">
              {activeProfileId
                ? '编辑下方配置后可「更新当前卡片」；或「保存为新卡片」再加一套，已有卡片不会被清掉。'
                : '新建模式：改 Base URL / Key / 模型后点「保存为新卡片」。点左侧旧卡片可随时切回。'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">AI 供应商</label>
            <select
              value={settings.provider}
              onChange={e => onProviderChange(e.target.value as Provider)}
              className="w-full ui-input"
            >
              {Object.entries(PROVIDERS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {settings.provider !== 'gemini' && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Base URL</label>
              <input
                type="text"
                value={settings.baseUrl || ''}
                onChange={e => setSettings({ ...settings, baseUrl: e.target.value })}
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
              <div className="space-y-2">
                {!settings.apiKeys || settings.apiKeys.length === 0 ? (
                  <div className="text-sm text-[var(--ui-muted)] italic">点击下方按钮添加密钥，支持添加多个密钥自动轮询</div>
                ) : (
                  settings.apiKeys.map((key, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="password"
                        value={key}
                        onChange={e => {
                          const newKeys = [...(settings.apiKeys || [])];
                          newKeys[index] = e.target.value;
                          setSettings({ ...settings, apiKeys: newKeys });
                        }}
                        placeholder={`密钥 ${index + 1}`}
                        className="flex-1 ui-input"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newKeys = (settings.apiKeys || []).filter((_, i) => i !== index);
                          setSettings({ ...settings, apiKeys: newKeys });
                        }}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                      >
                        删除
                      </button>
                    </div>
                  ))
                )}
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, apiKeys: [...(settings.apiKeys || []), ''] })}
                  className="ui-btn-secondary w-full"
                >
                  + 添加密钥
                </button>
                <p className="text-xs text-[var(--ui-muted)]">
                  已添加 {settings.apiKeys?.length || 0} 个密钥，系统会自动轮询使用。当某个密钥过期时会自动切换到下一个。
                </p>
              </div>
            ) : (
              <>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                  placeholder={settings.provider === 'gemini' ? '留空则使用系统默认 Key' : 'sk-...'}
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
                  type="button"
                  onClick={onDetectModels}
                  disabled={isTaskBusy}
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
                onChange={e => setSettings({ ...settings, model: e.target.value })}
                className="w-full ui-input"
              >
                {settings.availableModels.map(model => (
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
                onChange={e => setSettings({ ...settings, model: e.target.value })}
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
                onChange={e => setSettings({ ...settings, minWordCount: parseInt(e.target.value) || 2000 })}
                min={500}
                step={500}
                className="w-full ui-input"
              />
              <p className="text-xs text-[var(--ui-muted)] mt-1">AI 会尽量满足此字数要求，建议设置在 1000 - 3000 之间。</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-stone-700">创作自由度 (Temperature)</label>
                <span className="text-sm font-semibold text-[var(--ui-accent-text)]">
                  {(settings.temperature ?? 0.9).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                value={settings.temperature ?? 0.9}
                onChange={e => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
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
                {(settings.temperature ?? 0.9) >= 0.5 &&
                  (settings.temperature ?? 0.9) < 1.2 &&
                  '平衡模式，适合大多数创作场景'}
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
}
