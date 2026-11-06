import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeries, calendarFile, type Item } from '../app/lib/reminders.ts';
test('month-end recurrence retains its anchor after February', () => {
  const start = new Date(2027, 0, 31, 9, 30);
  const dates = buildSeries({ due: start.toISOString() }, start, 'monthly', 3).map(
    (x) => new Date(x.due),
  );
  assert.deepEqual(
    dates.map((x) => [x.getMonth(), x.getDate(), x.getHours()]),
    [
      [0, 31, 9],
      [1, 28, 9],
      [2, 31, 9],
    ],
  );
});
test('yearly recurrence handles leap days', () => {
  const start = new Date(2024, 1, 29, 9);
  assert.deepEqual(
    buildSeries({ due: start.toISOString() }, start, 'yearly', 5).map((x) =>
      new Date(x.due).getDate(),
    ),
    [29, 28, 28, 28, 29],
  );
});
test('weekly recurrence retains local time across DST', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const start = new Date(2027, 2, 7, 9);
    const dates = buildSeries({ due: start.toISOString() }, start, 'weekly', 3).map(
      (x) => new Date(x.due),
    );
    assert.deepEqual(
      dates.map((x) => x.getHours()),
      [9, 9, 9],
    );
    assert.equal(+dates[1] - +dates[0], 167 * 3600000);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test('ICS export escapes and folds UTF-8 content and includes an alarm', () => {
  const item: Item = {
    id: 'test-id',
    title: 'قسط '.repeat(40) + ',;\nEND:VEVENT',
    category: 'installment',
    amount: 100,
    due: '2027-02-01T09:00:00.000Z',
    timezone: 'Asia/Tehran',
    repeat: 'none',
    lead: 1440,
    note: 'Line one\nLine two',
    completed: false,
  };
  const ics = calendarFile([item]);
  assert.match(ics, /DTSTART:20270201T090000Z/);
  assert.match(ics, /TRIGGER:-PT1440M/);
  assert.equal(ics.split('\r\n').filter((x) => x === 'END:VEVENT').length, 1);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});
