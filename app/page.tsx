'use client';
import { useEffect, useState } from 'react';
import { Bell, Globe, LockKeyhole } from 'lucide-react';
import Dashboard from './Dashboard';
export default function Home() {
  const [state, setState] = useState<'loading' | 'login' | 'ready'>('loading'),
    [configured, setConfigured] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [lang, setLang] = useState<'en' | 'fa'>('en');
  const fa = lang === 'fa';
  useEffect(() => {
    if (localStorage.getItem('yadban-language') === 'fa') setLang('fa');
    fetch('/api/session')
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = (await r.json()) as { configured: boolean; authenticated: boolean };
        setConfigured(data.configured);
        setState(data.authenticated ? 'ready' : 'login');
      })
      .catch(() => {
        setError('Cannot reach the API. Start the application with npm run dev.');
        setState('login');
      });
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = fa ? 'rtl' : 'ltr';
  }, [lang, fa]);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const password = String(new FormData(event.currentTarget).get('password'));
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(data.error);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      const r = await fetch('/api/logout', { method: 'POST' });
      if (!r.ok) throw Error();
      setState('login');
      setError('');
    } catch {
      setError('Could not sign out. Please try again.');
    }
  }
  if (state === 'ready')
    return (
      <>
        <Dashboard signedIn signIn="/" onLogout={logout} />
        {error && (
          <div className="toast" role="alert">
            {error}
          </div>
        )}
      </>
    );
  return (
    <main className="login-screen" dir={fa ? 'rtl' : 'ltr'}>
      <section className="login-card">
        <div className="login-top">
          <span className="brand-icon">
            <Bell size={26} />
          </span>
          <button
            className="language"
            onClick={() => {
              const l = fa ? 'en' : 'fa';
              setLang(l);
              localStorage.setItem('yadban-language', l);
            }}
          >
            <Globe size={16} />
            {fa ? 'English' : 'فارسی'}
          </button>
        </div>
        <h1>{fa ? 'به یادبان خوش آمدی' : 'Welcome to Yadban'}</h1>
        <p>{fa ? 'یک چیز کمتر برای به خاطر سپردن.' : 'A little less to remember.'}</p>
        {state === 'loading' ? (
          <p role="status">{fa ? 'در حال اتصال…' : 'Connecting…'}</p>
        ) : (
          <form onSubmit={login}>
            <label>
              {fa ? 'رمز شخصی' : 'Your password'}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={256}
                required
                autoFocus
              />
            </label>
            {!configured && (
              <p className="form-notice">
                {fa
                  ? 'ابتدا دستور npm run setup را اجرا و تنظیمات سرور را تکمیل کن.'
                  : 'Run npm run setup and configure the server secrets before signing in.'}
              </p>
            )}
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !configured}>
              <LockKeyhole size={17} />
              {busy ? (fa ? 'در حال ورود…' : 'Signing in…') : fa ? 'ورود' : 'Sign in'}
            </button>
          </form>
        )}
        <small>
          {fa ? 'فضای شخصی شما برای موعدهای مهم' : 'Your personal space for the dates that matter.'}
        </small>
      </section>
    </main>
  );
}
