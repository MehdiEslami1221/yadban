'use client';
import { useEffect, useState } from 'react';
type Status = { configured: boolean; publicKey: string | null; lastCron: number | null };
export default function PushStatus({ language }: { language: 'en' | 'fa' }) {
  const fa = language === 'fa',
    text = (en: string, faText: string) => (fa ? faText : en);
  const [status, setStatus] = useState<Status | null>(null),
    [subscribed, setSubscribed] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function registration() {
    await navigator.serviceWorker.register('/sw.js');
    return navigator.serviceWorker.ready;
  }
  async function reload() {
    const r = await fetch('/api/push/status');
    if (!r.ok) throw Error('Unable to read notification settings.');
    setStatus(await r.json());
    if ('serviceWorker' in navigator && 'PushManager' in window)
      setSubscribed(!!(await (await registration()).pushManager.getSubscription()));
  }
  useEffect(() => {
    reload().catch(() =>
      setMessage(text('Cannot load notification settings.', 'تنظیمات اعلان دریافت نشد.')),
    );
  }, []);
  async function call(path: string, data: object) {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = (await r.json()) as { error?: string };
    if (!r.ok) throw Error(result.error || 'Request failed');
  }
  async function enable() {
    setBusy(true);
    setMessage('');
    try {
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      )
        throw Error(
          text(
            'Use a supported browser. On iPhone, add the app to your Home Screen first.',
            'از مرورگر سازگار استفاده کن. در آیفون ابتدا برنامه را به صفحهٔ اصلی اضافه کن.',
          ),
        );
      if (!status?.publicKey)
        throw Error(
          text('Configure server push keys first.', 'ابتدا کلیدهای اعلان سرور را تنظیم کن.'),
        );
      const permission = await Notification.requestPermission();
      if (permission !== 'granted')
        throw Error(
          text(
            'Allow notifications in browser settings.',
            'اجازهٔ اعلان را در تنظیمات مرورگر فعال کن.',
          ),
        );
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = Uint8Array.from(
          atob(status.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0),
        );
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      await call('/api/push/subscribe', { ...sub.toJSON(), language });
      setSubscribed(true);
      await call('/api/push/test', { endpoint: sub.endpoint });
      setMessage(
        text(
          'Test sent. Check this device’s notification center.',
          'اعلان آزمایشی ارسال شد؛ مرکز اعلان‌های این دستگاه را بررسی کن.',
        ),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to enable notifications.');
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await call('/api/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage(text('Notifications disabled for this device.', 'اعلان این دستگاه غیرفعال شد.'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to disable notifications.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="push-status">
      <button className="primary" onClick={enable} disabled={busy || !status?.configured}>
        {busy
          ? text('Please wait…', 'لطفاً صبر کن…')
          : subscribed
            ? text('Send server test', 'ارسال اعلان آزمایشی سرور')
            : text('Enable this device', 'فعال‌سازی این دستگاه')}
      </button>
      {subscribed && (
        <button className="text-button" disabled={busy} onClick={disable}>
          {text('Disable this device', 'غیرفعال‌سازی این دستگاه')}
        </button>
      )}
      <small>
        {status
          ? status.configured
            ? text('Server push keys are configured.', 'کلیدهای اعلان سرور تنظیم شده‌اند.')
            : text(
                'Push is not configured. Follow the deployment guide.',
                'اعلان سرور تنظیم نشده؛ راهنمای استقرار را دنبال کن.',
              )
          : text('Checking server…', 'بررسی سرور…')}
      </small>
      <small>
        {status?.lastCron
          ? text('Last scheduler run: ', 'آخرین اجرای زمان‌بندی: ') +
            new Date(status.lastCron).toLocaleString(fa ? 'fa-IR' : 'en-US')
          : text(
              'The scheduler has not reported a run yet.',
              'زمان‌بندی هنوز اجرایی گزارش نکرده است.',
            )}
      </small>
      <p className="form-hint">
        {text(
          'Connectivity, Focus mode and power restrictions may delay delivery. Test with the app closed.',
          'اینترنت، حالت تمرکز و تنظیمات باتری می‌تواند اعلان را به تأخیر بیندازد. با برنامهٔ بسته تست کن.',
        )}
      </p>
      {message && (
        <p role="status" className="form-notice">
          {message}
        </p>
      )}
      <button
        className="text-button"
        onClick={() => reload().catch(() => setMessage('Unable to refresh.'))}
      >
        {text('Refresh status', 'به‌روزرسانی وضعیت')}
      </button>
    </div>
  );
}
