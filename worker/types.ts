export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  PASSWORD_HASH: string;
  SESSION_SECRET: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
export interface Reminder {
  id: string;
  title: string;
  category: string;
  amount: number;
  due: string;
  timezone: string;
  repeat: string;
  lead: number;
  note: string;
  completed: number;
  created: string;
  notify_at: number;
  revision: number;
  version: number;
}
