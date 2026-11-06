'use client';
import { useEffect, useState, useRef } from 'react';
import PushStatus from './PushStatus';
import {
  Bell,
  Plus,
  LayoutDashboard,
  CalendarDays,
  Check,
  CheckCheck,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpLeft,
  Download,
  Globe,
  Wallet,
  Clock,
  Receipt,
  Ellipsis,
  Trash2,
  X,
  Edit3,
  Sun,
  CheckCircle2,
  Menu,
  Info,
  ArrowDownToLine,
  Smartphone,
  Repeat2,
} from 'lucide-react';
import Calendar from './Calendar';
import { messages as dict } from './lib/messages';
import { localISO, download, calendarFile, buildSeries, type Item } from './lib/reminders';
export default function Dashboard({
  signedIn,
  signIn,
  onLogout,
}: {
  signedIn: boolean;
  signIn: string;
  onLogout: () => void;
}) {
  const [lang, setLang] = useState<'fa' | 'en'>('en'),
    [page, setPage] = useState('dashboard'),
    [items, setItems] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [filter, setFilter] = useState('all'),
    [search, setSearch] = useState(''),
    [modal, setModal] = useState<Item | 'new' | null>(null),
    [saving, setSaving] = useState(false),
    [toast, setToast] = useState(''),
    [now, setNow] = useState<Date | null>(null),
    [month, setMonth] = useState(new Date()),
    [selected, setSelected] = useState(''),
    [menu, setMenu] = useState(false),
    [repeat, setRepeat] = useState('none');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const t = dict[lang],
    fa = lang === 'fa';
  const locale = fa ? 'fa-IR' : 'en-US';
  const number = (v: number) => new Intl.NumberFormat(locale).format(v);
  const date = (
    d: string | Date,
    opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' },
  ) => new Intl.DateTimeFormat(locale, opts).format(new Date(d));
  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 4000);
  };
  async function load() {
    setLoading(true);
    setError('');
    if (!signedIn) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch('/api/reminders');
      if (!r.ok) throw Error();
      setItems(await r.json());
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const l = localStorage.getItem('yadban-language');
    if (l === 'fa' || l === 'en') setLang(l);
    setNow(new Date());
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    load();
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = fa ? 'rtl' : 'ltr';
    localStorage.setItem('yadban-language', lang);
  }, [lang]);
  useEffect(() => {
    if (modal) {
      setRepeat('none');
      dialogRef.current?.showModal();
    } else dialogRef.current?.close();
  }, [modal]);

  const pending = items.filter((x) => !x.completed).sort((a, b) => a.due.localeCompare(b.due));
  const past = pending.filter((x) => now && new Date(x.due) < now);
  const upcoming = pending.filter((x) => !now || new Date(x.due) >= now);
  const next = upcoming[0] || pending[0];
  const total = pending
    .filter((x) => now && +new Date(x.due) >= +now && +new Date(x.due) < +now + 30 * 86400000)
    .reduce((s, x) => s + x.amount, 0);
  const visible = items
    .filter((x) => (page === 'history' ? x.completed : !x.completed))
    .filter((x) => filter === 'all' || x.category === filter)
    .filter(
      (x) =>
        x.title.toLowerCase().includes(search.toLowerCase()) ||
        x.note.toLowerCase().includes(search.toLowerCase()),
    )
    .filter((x) => page !== 'calendar' || !selected || localISO(new Date(x.due)) === selected)
    .sort((a, b) => a.due.localeCompare(b.due));
  function relative(item: Item) {
    if (!now) return '';
    const dayDiff = Math.round(
      (Date.UTC(
        new Date(item.due).getFullYear(),
        new Date(item.due).getMonth(),
        new Date(item.due).getDate(),
      ) -
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
        86400000,
    );
    return dayDiff === 0
      ? t.dueToday
      : dayDiff > 0
        ? `${number(dayDiff)} ${t.remaining}`
        : `${number(-dayDiff)} ${t.late}`;
  }
  async function mutate(method: string, body?: any, id?: string): Promise<any> {
    if (!navigator.onLine) throw Error(t.offline);
    const r = await fetch('/api/reminders' + (id ? '?id=' + id : ''), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw Error(t.error);
    return r.json();
  }
  async function complete(item: Item) {
    setSaving(true);
    try {
      const row = await mutate('PATCH', { id: item.id, completed: !item.completed });
      setItems((v) => v.map((x) => (x.id === row.id ? row : x)));
      notify(t.doneText);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: Item) {
    if (!confirm(t.confirm)) return;
    setSaving(true);
    try {
      await mutate('DELETE', undefined, item.id);
      setItems((v) => v.filter((x) => x.id !== item.id));
      notify(t.deleted);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      local = new Date(fd.get('date') + 'T' + fd.get('time'));
    if (!Number.isFinite(+local)) return;
    const data = {
      title: String(fd.get('title')),
      category: String(fd.get('category')),
      amount: Number(fd.get('amount') || 0),
      due: local.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lead: Number(fd.get('lead')),
      repeat: 'none',
      note: String(fd.get('note')),
    };
    setSaving(true);
    try {
      if (modal !== 'new' && modal) {
        const row = await mutate('PATCH', { ...data, id: modal.id });
        setItems((v) => v.map((x) => (x.id === row.id ? row : x)));
      } else {
        const count = repeat === 'none' ? 1 : Number(fd.get('count'));
        const batch = buildSeries(data, local, repeat, count);
        const rows = await mutate('POST', { items: batch });
        setItems((v) => [...v, ...rows]);
      }
      setModal(null);
      notify(t.saved);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function exportItems(rows: Item[]) {
    download('yadban-reminders.ics', calendarFile(rows), 'text/calendar;charset=utf-8');
    notify(t.calendarHint);
  }

  const navigation = [
    ['dashboard', LayoutDashboard, t.dashboard],
    ['reminders', Bell, t.reminders],
    ['calendar', CalendarDays, t.calendar],
    ['history', CheckCheck, t.history],
  ] as const;
  const edit = modal && modal !== 'new' ? modal : null;
  const defaultDate = edit ? new Date(edit.due) : new Date();
  return (
    <div className="shell" dir={fa ? 'rtl' : 'ltr'}>
      <aside className={'sidebar ' + (menu ? 'mobile-open' : '')}>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Bell size={25} />
          </span>
          <span>
            <strong>{t.brand}</strong>
            <small>{t.tag}</small>
          </span>
        </a>
        <div className="nav-caption">{t.private}</div>
        <nav>
          {navigation.map(([id, Icon, label]) => (
            <button
              className={page === id ? 'nav-item active' : 'nav-item'}
              key={id}
              onClick={() => {
                setPage(id);
                setFilter('all');
                setSelected('');
                setMenu(false);
              }}
            >
              <Icon size={20} />
              {label}
              {id === 'reminders' && pending.length > 0 && (
                <span className="nav-count">{number(pending.length)}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="side-card">
            <span className="soft-icon">
              <Smartphone size={22} />
            </span>
            <strong>{t.devices}</strong>
            <p>{t.devicesText}</p>
          </div>
          <button
            className={'nav-item ' + (page === 'settings' ? 'active' : '')}
            onClick={() => {
              setPage('settings');
              setMenu(false);
            }}
          >
            <Settings size={20} />
            {t.settings}
          </button>
          <button className="nav-item" onClick={onLogout}>
            {fa ? 'خروج از حساب' : 'Sign out'}
          </button>
          <div className="profile">
            <span className="avatar">M</span>
            <span>
              <strong>{t.private}</strong>
              <small>
                <span className="online-dot" />
                {signedIn ? t.status : t.signin}
              </small>
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Menu"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>{t.brand}</span>
            <span className="divider">/</span>
            <strong>{t[page as 'dashboard']}</strong>
          </div>
          <div className="top-actions">
            <span className="today-date">
              <CalendarDays size={16} />
              {now ? date(now, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}
            </span>
            <button className="language" onClick={() => setLang(fa ? 'en' : 'fa')}>
              <Globe size={16} />
              {fa ? 'English' : 'فارسی'}
            </button>
            <button
              className="icon-button"
              aria-label={t.settings}
              onClick={() => setPage('settings')}
            >
              <Bell size={19} />
            </button>
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="online-dot" />
                {t.today} ·{' '}
                {now ? date(now, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
              </div>
              <h1>{page === 'dashboard' ? t.hello : t[page as 'dashboard']}</h1>
              <p>{page === 'dashboard' ? t.intro : page === 'history' ? t.doneText : t.sub}</p>
            </div>
            <button className="primary" onClick={() => setModal('new')} disabled={!signedIn}>
              <Plus size={19} />
              {t.new}
            </button>
          </section>
          {!signedIn && (
            <div className="auth-panel">
              <p>{t.auth}</p>
              <a className="primary" href={signIn} target="_top">
                {t.signin}
              </a>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={load}>{fa ? 'تلاش مجدد' : 'Retry'}</button>
            </div>
          )}
          {page === 'settings' ? (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <span className="soft-icon">
                  <Bell />
                </span>
                <h2>{t.notif}</h2>
                <p>{t.notice}</p>
                <PushStatus language={lang} />
                <hr />
                <h3>{t.export}</h3>
                <p>{t.calendarHint}</p>
                <button
                  className="secondary"
                  disabled={!pending.length}
                  onClick={() => exportItems(pending)}
                >
                  <Download size={17} />
                  {t.exportAll}
                </button>
              </section>
              <section className="panel settings-panel">
                <h2>{t.language}</h2>
                <div className="segments">
                  <button className={fa ? 'selected' : ''} onClick={() => setLang('fa')}>
                    فارسی
                  </button>
                  <button className={!fa ? 'selected' : ''} onClick={() => setLang('en')}>
                    English
                  </button>
                </div>
                <h3>{t.timezone}</h3>
                <p dir="ltr">{now ? Intl.DateTimeFormat().resolvedOptions().timeZone : '—'}</p>
                <hr />
                <h3>{t.data}</h3>
                <p>{t.backupHint}</p>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      'yadban-backup.json',
                      JSON.stringify(
                        { version: 1, exportedAt: new Date().toISOString(), reminders: items },
                        null,
                        2,
                      ),
                      'application/json',
                    )
                  }
                >
                  <Download size={17} />
                  {t.backup}
                </button>
              </section>
            </div>
          ) : (
            <>
              {page === 'dashboard' && (
                <section className="stats">
                  <div className="stat">
                    <div>
                      <span>{t.pending}</span>
                      <strong>
                        {loading ? '—' : number(pending.length)}
                        <small>{t.count}</small>
                      </strong>
                    </div>
                    <span className="stat-icon green">
                      <Bell size={22} />
                    </span>
                  </div>
                  <div className="stat">
                    <div>
                      <span>{t.monthly}</span>
                      <strong>
                        {loading ? '—' : number(total)}
                        <small>{t.toman}</small>
                      </strong>
                    </div>
                    <span className="stat-icon lavender">
                      <Wallet size={22} />
                    </span>
                  </div>
                  <div className="stat">
                    <div>
                      <span>{t.overdue}</span>
                      <strong>
                        {loading ? '—' : number(past.length)}
                        <small>{t.count}</small>
                      </strong>
                    </div>
                    <span className="stat-icon peach">
                      <Clock size={22} />
                    </span>
                  </div>
                </section>
              )}
              <div className="content-grid">
                <section className="panel reminder-panel">
                  {page === 'calendar' && (
                    <Calendar
                      month={month}
                      setMonth={setMonth}
                      lang={lang}
                      items={pending}
                      selected={selected}
                      select={setSelected}
                    />
                  )}
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {page === 'history'
                          ? t.history
                          : page === 'calendar' && selected
                            ? t.dayEvents
                            : t.list}
                        <span className="count-badge">{number(visible.length)}</span>
                      </h2>
                      <p>
                        {page === 'calendar' && selected
                          ? date(selected + 'T12:00:00', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : t.sub}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      title={t.exportAll}
                      aria-label={t.exportAll}
                      disabled={!pending.length}
                      onClick={() => exportItems(pending)}
                    >
                      <ArrowDownToLine size={20} />
                    </button>
                  </div>
                  <div className="list-tools">
                    <div className="tabs">
                      {['all', 'installment', 'bill', 'personal'].map((k) => (
                        <button
                          key={k}
                          className={filter === k ? 'selected' : ''}
                          onClick={() => setFilter(k)}
                        >
                          {t[k as 'all']}
                        </button>
                      ))}
                    </div>
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label={t.search}
                        placeholder={t.search}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  {selected && page === 'calendar' && (
                    <button className="text-button" onClick={() => setSelected('')}>
                      {t.clear}
                    </button>
                  )}
                  <div className="reminder-list">
                    {loading ? (
                      <div className="empty">
                        <span className="loader" />
                        <p>{t.loading}</p>
                      </div>
                    ) : visible.length ? (
                      visible.map((item) => (
                        <article
                          className={'reminder-row ' + (item.completed ? 'completed' : '')}
                          key={item.id}
                        >
                          <span className={'item-icon ' + item.category}>
                            {item.category === 'installment' ? (
                              <Wallet size={21} />
                            ) : item.category === 'bill' ? (
                              <Receipt size={21} />
                            ) : (
                              <Bell size={21} />
                            )}
                          </span>
                          <div className="item-main">
                            <h3>{item.title}</h3>
                            <p>
                              <CalendarDays size={13} />
                              {date(item.due)}
                              <span>·</span>
                              {date(item.due, { hour: '2-digit', minute: '2-digit' })}
                              <span
                                className={
                                  'due-chip ' +
                                  (!item.completed && now && new Date(item.due) < now
                                    ? 'overdue-chip'
                                    : '')
                                }
                              >
                                {item.completed ? t.paid : relative(item)}
                              </span>
                            </p>
                            {item.note && <small>{item.note}</small>}
                          </div>
                          <div className="item-amount">
                            {item.amount > 0 ? (
                              <>
                                <strong>{number(item.amount)}</strong>
                                <small>{t.toman}</small>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                          <div className="row-actions">
                            <button
                              className="complete-button"
                              title={item.completed ? t.undo : t.complete}
                              aria-label={item.completed ? t.undo : t.complete}
                              disabled={saving}
                              onClick={() => complete(item)}
                            >
                              <Check size={17} />
                            </button>
                            <details>
                              <summary aria-label={t.edit}>
                                <Ellipsis size={20} />
                              </summary>
                              <div className="row-menu">
                                <button onClick={() => setModal(item)}>
                                  <Edit3 size={15} />
                                  {t.edit}
                                </button>
                                <button onClick={() => exportItems([item])}>
                                  <CalendarDays size={15} />
                                  {t.export}
                                </button>
                                <button
                                  className="danger"
                                  disabled={saving}
                                  onClick={() => remove(item)}
                                >
                                  <Trash2 size={15} />
                                  {t.remove}
                                </button>
                              </div>
                            </details>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty">
                        <div className="empty-art">
                          <div className="art-back" />
                          <div className="art-calendar">
                            <span />
                            <div>
                              <Check size={26} />
                            </div>
                          </div>
                          <span className="art-bell">
                            <Bell size={21} />
                          </span>
                          <i />
                        </div>
                        <h3>{items.length || page === 'history' ? t.nothing : t.empty}</h3>
                        <p>{items.length || page === 'history' ? t.nothingDesc : t.emptyDesc}</p>
                        {page !== 'history' && (
                          <button
                            className="secondary"
                            disabled={!signedIn}
                            onClick={() => setModal('new')}
                          >
                            <Plus size={17} />
                            {t.add}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="list-footer">
                    <span>
                      <span className="online-dot" />
                      {t.status}
                    </span>
                    <span>YADBAN</span>
                  </div>
                </section>
                <aside className="right-column">
                  <section className="next-card">
                    <div className="next-label">
                      <span>
                        <Clock size={16} />
                        {t.next}
                      </span>
                      <span className="pulse" />
                    </div>
                    {next ? (
                      <>
                        <div className="next-date">
                          {date(next.due, { day: 'numeric' })}
                          <small>{date(next.due, { month: 'long' })}</small>
                        </div>
                        <h2>{next.title}</h2>
                        <p>
                          {date(next.due, { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <div className="next-bottom">
                          <strong>
                            {next.amount ? number(next.amount) + ' ' + t.toman : relative(next)}
                          </strong>
                          <button aria-label={t.export} onClick={() => exportItems([next])}>
                            <ArrowUpLeft size={20} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="next-illustration">
                          <CalendarDays size={46} />
                          <span>
                            <Check size={18} />
                          </span>
                        </div>
                        <h2>{t.noNext}</h2>
                        <p>{t.noNextDesc}</p>
                        <div className="next-bottom">
                          <span>{t.sub}</span>
                          <Plus size={20} />
                        </div>
                      </>
                    )}
                  </section>
                  <section className="notification-card">
                    <span className="soft-icon">
                      <Bell size={22} />
                    </span>
                    <h3>{t.notif}</h3>
                    <p>{t.notifDesc}</p>
                    <button className="text-button" onClick={() => setPage('settings')}>
                      {t.settings}
                      {fa ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </section>
                  <div className="quiet-note">
                    <span>✦</span>
                    <p>{t.tag}</p>
                  </div>
                </aside>
              </div>
            </>
          )}
          <footer>
            <span>Yadban</span>
            <span>
              {t.tag} <span className="footer-dot">·</span>{' '}
              {fa ? 'ساخته‌شده برای روزهای شلوغ' : 'Made for busy days'}
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialogRef}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        {modal && (
          <form key={edit?.id || 'new'} onSubmit={save}>
            <div className="dialog-heading">
              <span className="soft-icon">
                <Bell size={22} />
              </span>
              <h2>{edit ? t.editTitle : t.new}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label={t.cancel}
                onClick={() => setModal(null)}
              >
                <X size={21} />
              </button>
            </div>
            <label>
              {t.title}
              <input
                name="title"
                required
                maxLength={120}
                autoFocus
                placeholder={t.titlePlaceholder}
                defaultValue={edit?.title}
              />
            </label>
            <div className="form-grid">
              <label>
                {t.category}
                <select name="category" defaultValue={edit?.category || 'installment'}>
                  {['installment', 'bill', 'personal'].map((k) => (
                    <option key={k} value={k}>
                      {t[k as 'installment']}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.amount}
                <input
                  name="amount"
                  type="number"
                  min="0"
                  max="1000000000000000"
                  step="1"
                  defaultValue={edit?.amount || ''}
                  placeholder="0"
                />
              </label>
              <label>
                {t.date}
                <input name="date" type="date" required defaultValue={localISO(defaultDate)} />
              </label>
              <label>
                {t.time}
                <input
                  name="time"
                  type="time"
                  required
                  defaultValue={
                    edit
                      ? `${String(defaultDate.getHours()).padStart(2, '0')}:${String(defaultDate.getMinutes()).padStart(2, '0')}`
                      : '09:00'
                  }
                />
              </label>
            </div>
            <small className="form-hint">
              {t.timezone}: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </small>
            <label>
              {t.lead}
              <select name="lead" defaultValue={edit?.lead ?? 1440}>
                {[
                  [0, t.same],
                  [60, t.hour],
                  [1440, t.day],
                  [4320, t.three],
                  [10080, t.week],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {!edit && (
              <>
                <div className="form-grid">
                  <label>
                    {t.repeat}
                    <select value={repeat} onChange={(e) => setRepeat(e.target.value)}>
                      <option value="none">{t.once}</option>
                      <option value="weekly">{t.weekly}</option>
                      <option value="monthly">{t.monthlyRepeat}</option>
                      <option value="yearly">{t.yearly}</option>
                    </select>
                  </label>
                  {repeat !== 'none' && (
                    <label>
                      {t.occurrences}
                      <input
                        name="count"
                        type="number"
                        min="2"
                        max="36"
                        required
                        defaultValue="12"
                      />
                    </label>
                  )}
                </div>
                {repeat !== 'none' && <small className="form-hint">{t.repeatHint}</small>}
              </>
            )}
            <label>
              {t.note}
              <textarea
                name="note"
                maxLength={1000}
                rows={2}
                placeholder={t.notePlaceholder}
                defaultValue={edit?.note}
              />
            </label>
            <div className="form-notice">
              <Info size={16} />
              <span>{t.notice}</span>
            </div>
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={() => setModal(null)}>
                {t.cancel}
              </button>
              <button className="primary" disabled={saving}>
                {saving ? t.saving : t.save}
                <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}
