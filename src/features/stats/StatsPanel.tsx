import { useMemo } from 'react';
import type { WritingEvent } from '../../types';

export function StatsPanel({
  events,
  chaptersCount,
  target,
}: {
  events: WritingEvent[];
  chaptersCount: number;
  target: number;
}) {
  const { days, maxWords, cards, completion } = useMemo(() => {
    const today = new Date();
    const nextDays = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (29 - index));
      const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return {
        date: dateText,
        words: 0,
        isToday: index === 29,
      };
    });
    const dayIndex = new Map(nextDays.map((day, index) => [day.date, index]));
    events.forEach(event => {
      const index = dayIndex.get(event.date);
      if (index !== undefined) nextDays[index].words += event.words || 0;
    });

    const activeDays = nextDays.filter(day => day.words > 0);
    const nextMaxWords = Math.max(...nextDays.map(day => day.words), 1);
    const totalWords = activeDays.reduce((sum, day) => sum + day.words, 0);
    const dailyRate = Math.round((activeDays.length / 30) * 100);

    let streak = 0;
    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateText = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (dayIndex.get(dateText) !== undefined && nextDays[dayIndex.get(dateText) as number].words > 0) {
        streak += 1;
      } else if (offset === 0) {
        continue;
      } else {
        break;
      }
    }

    const nextCompletion = Math.min(Math.round((chaptersCount / Math.max(target, 1)) * 100), 100);
    const nextCards = [
      { label: '30 日新增', value: totalWords.toLocaleString(), unit: '字' },
      { label: '日更率', value: String(dailyRate), unit: '%' },
      { label: '连续码字', value: String(streak), unit: '天' },
      { label: '完成章节', value: `${chaptersCount}/${target}`, unit: '' },
    ];
    return { days: nextDays, maxWords: nextMaxWords, cards: nextCards, completion: nextCompletion };
  }, [events, chaptersCount, target]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ui-ink)]">创作统计</h2>
        <p className="text-sm text-[var(--ui-muted)] mt-1">记录每次生成带来的正文字数增量，帮你看到真实的连载节奏。</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <div key={card.label} className="ui-card !p-4">
            <p className="ui-side-label">{card.label}</p>
            <p className="text-xl font-semibold tabular-nums text-[var(--ui-ink)] mt-1">
              {card.value}
              {card.unit && <span className="text-xs font-normal text-[var(--ui-muted)] ml-1">{card.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <div className="ui-card !p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--ui-ink)]">近 30 日字数曲线</h3>
          <span className="text-xs text-[var(--ui-muted)]">峰值 {maxWords.toLocaleString()} 字</span>
        </div>
        <div className="mt-4 h-44 flex items-end gap-[3px] border-b border-[var(--ui-line)] pb-1">
          {days.map(day => (
            <div
              key={day.date}
              title={`${day.date}：${day.words.toLocaleString()} 字`}
              className={`flex-1 min-w-[3px] rounded-t-sm transition-all ${day.isToday ? 'bg-[var(--ui-accent)]' : 'bg-emerald-400/80 hover:bg-emerald-500'}`}
              style={{ height: day.words > 0 ? `${Math.max((day.words / maxWords) * 100, 4)}%` : '3px' }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-[var(--ui-muted)] mt-1.5">
          <span>{days[0].date}</span>
          <span>今天</span>
        </div>
      </div>

      <div className="ui-card !p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--ui-ink)]">完本进度</h3>
          <span className="text-sm tabular-nums font-semibold text-[var(--ui-accent-text)]">{completion}%</span>
        </div>
        <div className="ui-progress-track mt-3">
          <div className="ui-progress-fill" style={{ width: `${completion}%` }} />
        </div>
        <p className="text-xs text-[var(--ui-muted)] mt-2">
          当前按目标章数计算；多生成目录后会逐步更新。总字数按每章正文去掉空白后统计。
        </p>
      </div>
    </div>
  );
}
