export type Item = {
  id: string;
  title: string;
  category: string;
  amount: number;
  due: string;
  timezone: string;
  repeat: string;
  lead: number;
  note: string;
  completed: boolean;
};
export function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (m) => '\\' + m)
    .replace(/\r/g, '');
export function calendarFile(items: Item[]) {
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yadban//Reminders//EN',
    'CALSCALE:GREGORIAN',
    ...items.flatMap((r) => [
      'BEGIN:VEVENT',
      `UID:${r.id}@yadban`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(new Date(r.due))}`,
      `DTEND:${stamp(new Date(+new Date(r.due) + 1800000))}`,
      `SUMMARY:${esc(r.title)}`,
      `DESCRIPTION:${esc(r.note + (r.amount ? '\n' + r.amount + ' toman' : ''))}`,
      'BEGIN:VALARM',
      r.lead ? `TRIGGER:-PT${r.lead}M` : 'TRIGGER:PT0S',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(r.title)}`,
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return (
    lines
      .map((line) => {
        let result = '',
          bytes = 0;
        for (const c of line) {
          const n = new TextEncoder().encode(c).length;
          if (bytes + n > 73) {
            result += '\r\n ';
            bytes = 1;
          }
          result += c;
          bytes += n;
        }
        return result;
      })
      .join('\r\n') + '\r\n'
  );
}
export function buildSeries<T extends { due: string }>(
  data: T,
  start: Date,
  repeat: string,
  count: number,
): T[] {
  if (!Number.isInteger(count) || count < 1 || count > 36)
    throw new Error('Series must contain 1–36 dates.');
  return Array.from({ length: count }, (_, i) => {
    const due = new Date(start);
    if (repeat === 'weekly') due.setDate(start.getDate() + 7 * i);
    if (repeat === 'monthly' || repeat === 'yearly') {
      due.setDate(1);
      due.setMonth(start.getMonth() + (repeat === 'monthly' ? i : 12 * i));
      due.setDate(
        Math.min(start.getDate(), new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate()),
      );
    }
    return { ...data, due: due.toISOString() };
  });
}
