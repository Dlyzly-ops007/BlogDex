import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { storageKey: 'blogdex-auth' } },
);

export function check(result) {
  if (result.error) throw result.error;
  return result.data;
}

export function friendlyError(error) {
  const message = error?.message || 'Something went wrong. Please try again.';
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error?.code) || /schema cache|does not exist/i.test(message))
    return 'BlogDex tables are not set up yet. Run supabase/schema.sql in the Supabase SQL Editor, then refresh.';
  if (error?.code === '23505') return 'That username or record already exists. Please choose another.';
  if (/failed to fetch|network/i.test(message)) return 'Could not reach Supabase. Check your internet connection and try again.';
  if (error?.code === '42501') return 'You do not have permission for this action. Your account may be suspended.';
  return message;
}

export function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function compact(value = 0) {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

