import { useState } from 'react';
import { BookOpen, Loader2, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { EXAMPLE_LINKS } from '../../config/examples';
import type { StyleCard } from '../../types';

export function ExamplesPanel({
  styleCards,
  busy,
  onExtractStyle,
  onToggleStyle,
  onDeleteStyle,
}: {
  styleCards: StyleCard[];
  busy: boolean;
  onExtractStyle: (name: string, excerpt: string) => void;
  onToggleStyle: (id: string) => void;
  onDeleteStyle: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const excerptLength = excerpt.replace(/\s/g, '').length;
  const canExtract = !busy && !!name.trim() && excerptLength >= 200;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">风格工坊</h2>
          <p className="text-sm text-[var(--ui-muted)] mt-1">粘贴范文提取风格卡，生成正文时按启用的卡片注入写作风格。</p>
        </div>
      </div>

      <div className="ui-form-card !p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="text-sm font-medium text-stone-700">风格卡名称</label>
          <span className={`text-xs tabular-nums ${excerptLength >= 200 ? 'text-emerald-600' : 'text-[var(--ui-muted)]'}`}>
            范文有效长度 {excerptLength} / 200
          </span>
        </div>
        <input
          className="ui-input text-sm mt-2"
          placeholder="如：冷峻快节奏 / 细腻日常流"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <textarea
          className="ui-input text-sm mt-3 leading-relaxed"
          rows={8}
          placeholder="粘贴 200 字以上的范文。建议选能代表叙事、对话、情绪和句式节奏的片段。"
          value={excerpt}
          onChange={event => setExcerpt(event.target.value)}
        />
        <div className="flex justify-end mt-3">
          <button
            type="button"
            className="ui-btn-primary text-sm disabled:opacity-50"
            disabled={!canExtract}
            onClick={() => {
              onExtractStyle(name.trim(), excerpt);
              setName('');
              setExcerpt('');
            }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Wand2 className="w-4 h-4 inline mr-1" />}
            提取风格卡
          </button>
        </div>
      </div>

      {styleCards.length === 0 ? (
        <p className="text-sm text-[var(--ui-muted)] text-center py-8">
          还没有风格卡。粘贴范文提取一张，生成时可以让正文更贴近你喜欢的写法。
        </p>
      ) : (
        <div className="space-y-3">
          {styleCards.map(card => (
            <div
              key={card.id}
              className={`rounded-xl border px-3.5 py-3 transition ${card.enabled ? 'border-[var(--ui-line)] bg-white/88' : 'border-stone-200 bg-stone-50/80'}`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[var(--ui-ink)] truncate">{card.name}</span>
                    {card.enabled ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">生成时注入</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">已停用</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--ui-muted)] mt-1 leading-relaxed whitespace-pre-wrap">{card.traits}</p>
                  <p className="text-[10px] text-[var(--ui-muted)] mt-1 truncate">范文样本：{card.excerpt}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="text-[11px] text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={() => onToggleStyle(card.id)}>
                    {card.enabled ? '停用' : '启用'}
                  </button>
                  <button type="button" className="text-red-400 hover:text-red-600" title="删除风格卡" onClick={() => onDeleteStyle(card.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
        <p className="text-sm text-amber-800">也可以先读下方范文，再把合适的片段粘贴到上方提取风格。</p>
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
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
