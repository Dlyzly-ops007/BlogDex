import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { check, friendlyError, supabase, timeAgo } from '../lib';
import { Avatar, Empty, ErrorBox, Icon, Spinner } from '../components/ui';

export default function Notifications() {
  const { profile, version, refresh, notify, unread } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = check(await supabase.from('blogdex_notifications').select('*,actor:blogdex_profiles!blogdex_notifications_actor_id_fkey(*)').eq('recipient_id', profile.id).order('created_at', { ascending: false }).limit(limit));
        if (!cancelled) { setRows(data); setError(''); }
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [profile.id, version, limit]);
  async function markRead(id = null) {
    try {
      let query = supabase.from('blogdex_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', profile.id).is('read_at', null);
      if (id) query = query.eq('id', id);
      check(await query); refresh();
    } catch (error) { notify(friendlyError(error), 'error'); }
  }
  const descriptions = { like: 'liked your post', comment: 'replied to your post', follow: 'started following you' };
  return <section className="main-column"><div className="page-heading"><div><span className="eyebrow">A LITTLE SOMETHING FOR YOU.</span><h1>Notifications<span className="heading-dot">.</span></h1><p>Keep up with the connections you’re making.</p></div><span className="page-heading-icon"><Icon name="bell" size={25} /></span></div><div className="section-heading notification-section"><h2>Recent activity{unread > 0 && <span className="count-badge">{unread}</span>}</h2><button className="text-button" disabled={!unread} onClick={() => markRead()}><Icon name="check" size={15} /> Mark all read</button></div><ErrorBox message={error} />{loading ? <Spinner /> : !rows.length ? <div className="notification-list"><Empty icon="bell" title="Quiet for now. Good things are coming." description="Likes, replies, and new followers will find their way here." /></div> : <div className="notification-list">{rows.map(row => <Link key={row.id} className={`notification-row ${row.read_at ? '' : 'unread'}`} to={row.kind === 'follow' ? `/profile/${row.actor?.username}` : `/post/${row.post_id}`} onClick={() => { if (!row.read_at) markRead(row.id); }}><div className="notification-avatar"><Avatar profile={row.actor} /><span className={`notification-kind kind-${row.kind}`}><Icon name={row.kind === 'like' ? 'heart' : row.kind === 'comment' ? 'message' : 'users'} size={11} /></span></div><div><p><strong>{row.actor?.display_name || 'A community member'}</strong> {descriptions[row.kind]}.</p><span>@{row.actor?.username || 'member'} · {timeAgo(row.created_at)}</span></div>{!row.read_at && <i className="unread-dot" />}<Icon name="chevron" size={16} /></Link>)}</div>}{rows.length >= limit && <button className="button secondary load-more" onClick={() => setLimit(value => value + 40)}>Show more activity</button>}</section>;
}
