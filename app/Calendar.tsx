import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localISO, type Item } from './lib/reminders';

export default function Calendar({
  month,
  setMonth,
  lang,
  items,
  selected,
  select,
}: {
  month: Date;
  setMonth: (d: Date) => void;
  lang: string;
  items: Item[];
  selected: string;
  select: (s: string) => void;
}) {
  const fa = lang === 'fa',
    fmt = (d: Date, o: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', o).format(d);
  let start: Date, end: Date;
  if (fa) {
    const parts = new Intl.DateTimeFormat('en-u-ca-persian', { day: 'numeric' }).format(month);
    start = new Date(month.getFullYear(), month.getMonth(), month.getDate() - Number(parts) + 1);
    end = new Date(start);
    end.setDate(end.getDate() + 29);
    while (new Intl.DateTimeFormat('en-u-ca-persian', { day: 'numeric' }).format(end) !== '1')
      end.setDate(end.getDate() + 1);
  } else {
    start = new Date(month.getFullYear(), month.getMonth(), 1);
    end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  }
  const offset = (start.getDay() + (fa ? 1 : 0)) % 7;
  const count = Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
  );
  const weekdays = fa ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="calendar">
      <div className="calendar-head">
        <h2>{fmt(month, { month: 'long', year: 'numeric' })}</h2>
        <div>
          <button
            className="icon-button"
            aria-label={fa ? 'ماه قبل' : 'Previous month'}
            onClick={() => {
              const d = new Date(start);
              d.setDate(d.getDate() - 1);
              setMonth(d);
            }}
          >
            {fa ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setMonth(new Date());
              select('');
            }}
          >
            {fa ? 'امروز' : 'Today'}
          </button>
          <button
            className="icon-button"
            aria-label={fa ? 'ماه بعد' : 'Next month'}
            onClick={() => setMonth(end)}
          >
            {fa ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {weekdays.map((w, i) => (
          <span className="weekday" key={'w' + i}>
            {w}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={'blank' + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const key = localISO(d),
            n = items.filter((x) => localISO(new Date(x.due)) === key).length;
          return (
            <button
              key={key}
              className={
                (selected === key ? 'selected ' : '') +
                (key === localISO(new Date()) ? 'current-day' : '')
              }
              onClick={() => select(key)}
            >
              {fmt(d, { day: 'numeric' })}
              {n > 0 && <span className="calendar-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
