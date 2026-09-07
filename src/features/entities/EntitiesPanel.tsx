import { useState } from 'react';
import { Loader2, MapPin, Package, Scroll, Sparkles, Swords, Users } from 'lucide-react';
import type { EntityCard, EntityCardType } from '../../types';

const TYPE_META: Record<EntityCardType, { label: string; icon: typeof Users }> = {
  character: { label: '人物', icon: Users },
  location: { label: '地点', icon: MapPin },
  item: { label: '物品/法宝', icon: Package },
  faction: { label: '势力/组织', icon: Swords },
  thread: { label: '伏笔/约定', icon: Scroll },
};

export function EntitiesPanel({
  entities,
  busy,
  onAdd,
  onUpdate,
  onDelete,
  onToggleEnabled,
  onTogglePinned,
  onExtract,
}: {
  entities: EntityCard[];
  busy: boolean;
  onAdd: (card: Omit<EntityCard, 'id' | 'createdAt'>) => void;
  onUpdate: (id: string, patch: Partial<EntityCard>) => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (id: string) => void;
  onTogglePinned: (id: string) => void;
  onExtract: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'item' as EntityCardType, description: '', keywords: '', pinned: false });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', type: 'item', description: '', keywords: '', pinned: false });
  };

  const submit = () => {
    const name = form.name.trim();
    if (!name) return;
    const keywords = form.keywords.split(/[，,、\s]+/).map(k => k.trim()).filter(Boolean);
    if (editingId) {
      onUpdate(editingId, { name, type: form.type, description: form.description.trim(), keywords, pinned: form.pinned });
    } else {
      onAdd({ name, type: form.type, description: form.description.trim(), keywords, pinned: form.pinned, enabled: true });
    }
    resetForm();
  };

  const startEdit = (card: EntityCard) => {
    setEditingId(card.id);
    setForm({ name: card.name, type: card.type, description: card.description, keywords: card.keywords.join('、'), pinned: card.pinned });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">设定库（实体卡）</h2>
          <p className="text-sm text-[var(--ui-muted)] mt-1">
            人物、地点、物品、势力、伏笔各一张卡。生成正文时：钉选卡每章必注入，其余卡按关键词命中本章摘要后注入。
          </p>
        </div>
        <button
          type="button"
          className="ui-btn-secondary text-sm disabled:opacity-50"
          disabled={busy}
          onClick={onExtract}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : <Sparkles className="w-4 h-4 inline mr-1" />}
          AI 从大纲提取
        </button>
      </div>

      <div className="ui-form-card !p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="ui-input text-sm"
            placeholder="名称，如：青云剑"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="ui-input text-sm"
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value as EntityCardType })}
          >
            {(Object.keys(TYPE_META) as EntityCardType[]).map(t => (
              <option key={t} value={t}>{TYPE_META[t].label}</option>
            ))}
          </select>
          <input
            className="ui-input text-sm md:col-span-2"
            placeholder="触发关键词，逗号分隔，如：青云剑,师门信物"
            value={form.keywords}
            onChange={e => setForm({ ...form, keywords: e.target.value })}
          />
        </div>
        <textarea
          className="ui-input text-sm mt-3"
          rows={2}
          placeholder="设定描述（60-150字），含当前状态，如：主角佩剑，已认主，可引动雷灵力"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <label className="text-xs text-[var(--ui-muted)] flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}
            />
            每章必注入（钉选）
          </label>
          <div className="flex gap-2">
            {editingId && (
              <button type="button" className="ui-btn-secondary text-sm" onClick={resetForm}>取消</button>
            )}
            <button type="button" className="ui-btn-primary text-sm" onClick={submit}>
              {editingId ? '保存修改' : '添加卡片'}
            </button>
          </div>
        </div>
      </div>

      {entities.length === 0 ? (
        <p className="text-sm text-[var(--ui-muted)] text-center py-8">
          还没有设定卡。手动添加，或点「AI 从大纲提取」自动整理。
        </p>
      ) : (
        <div className="space-y-3">
          {(Object.keys(TYPE_META) as EntityCardType[]).map(type => {
            const cards = entities.filter(c => c.type === type);
            if (cards.length === 0) return null;
            const Icon = TYPE_META[type].icon;
            return (
              <div key={type}>
                <p className="ui-side-label flex items-center gap-1.5 mb-2">
                  <Icon className="w-3.5 h-3.5" />
                  {TYPE_META[type].label}（{cards.length}）
                </p>
                <div className="space-y-2">
                  {cards.map(card => (
                    <div key={card.id} className="rounded-xl border border-[var(--ui-line)] bg-white/85 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-[var(--ui-ink)] truncate">{card.name}</span>
                          {card.pinned && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--ui-accent-soft)] text-[var(--ui-accent-text)]">钉选</span>}
                          {!card.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">已停用</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button type="button" className="text-[11px] text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={() => onToggleEnabled(card.id)}>
                            {card.enabled ? '停用' : '启用'}
                          </button>
                          <button type="button" className="text-[11px] text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={() => onTogglePinned(card.id)}>
                            {card.pinned ? '取消钉选' : '钉选'}
                          </button>
                          <button type="button" className="text-[11px] text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" onClick={() => startEdit(card)}>编辑</button>
                          <button type="button" className="text-[11px] text-red-500 hover:text-red-600" onClick={() => onDelete(card.id)}>删除</button>
                        </div>
                      </div>
                      {card.description && <p className="text-xs text-[var(--ui-muted)] mt-1 leading-relaxed">{card.description}</p>}
                      {card.keywords.length > 0 && (
                        <p className="text-[10px] text-[var(--ui-muted)] mt-1">触发词：{card.keywords.join('、')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
