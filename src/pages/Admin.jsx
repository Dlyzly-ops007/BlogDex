import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { check, compact, friendlyError, supabase, timeAgo } from '../lib';
import { Avatar, Empty, ErrorBox, Icon, Modal, PostText, Spinner } from '../components/ui';

export default function Admin() {
  const { version, refresh, notify, profile } = useApp();
  const [tab, setTab] = useState('reports');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  useEffect(() => { setLimit(50); setRows([]); setSearch(''); }, [tab]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    (async () => {
      try {
        const counts = await Promise.all([
          supabase.from('blogdex_profiles').select('id', { head: true, count: 'exact' }),
          supabase.from('blogdex_posts').select('id', { head: true, count: 'exact' }),
          supabase.from('blogdex_reports').select('id', { head: true, count: 'exact' }).eq('status', 'open'),
          supabase.from('blogdex_profiles').select('id', { head: true, count: 'exact' }).eq('is_suspended', true),
        ]);
        counts.forEach(check);
        if (!cancelled) setStats({ users: counts[0].count, posts: counts[1].count, reports: counts[2].count, suspended: counts[3].count });
        let query;
        if (tab === 'users') query = supabase.rpc('blogdex_admin_users').limit(limit);
        else if (tab === 'posts') query = supabase.from('blogdex_posts').select('*,author:blogdex_profiles!blogdex_posts_author_id_fkey(*)').order('created_at', { ascending: false }).limit(limit);
        else if (tab === 'comments') query = supabase.from('blogdex_comments').select('*,author:blogdex_profiles!blogdex_comments_author_id_fkey(*)').order('created_at', { ascending: false }).limit(limit);
        else if (tab === 'reports') query = supabase.from('blogdex_reports').select('*,reporter:blogdex_profiles!blogdex_reports_reporter_id_fkey(*),post:blogdex_posts!blogdex_reports_post_id_fkey(*,author:blogdex_profiles!blogdex_posts_author_id_fkey(*))').order('created_at', { ascending: false }).limit(limit);
        else query = supabase.from('blogdex_audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
        const data = check(await query);
        if (!cancelled) setRows(data);
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tab, version, limit]);
  async function perform() {
    setBusy(true);
    try {
      if (action.type === 'user') check(await supabase.rpc('blogdex_suspend_user', { target_id: action.row.id, suspend_user: !action.row.is_suspended }));
      if (action.type === 'post') check(await supabase.rpc('blogdex_moderate_post', { target_id: action.row.id, remove_post: !action.row.removed_at }));
      if (action.type === 'comment') check(await supabase.from('blogdex_comments').delete().eq('id', action.row.id));
      if (action.type === 'report') check(await supabase.rpc('blogdex_resolve_report', { target_id: action.row.id, resolution: action.resolution }));
      notify('Moderation action completed.'); setAction(null); refresh();
    } catch (error) { notify(friendlyError(error), 'error'); }
    finally { setBusy(false); }
  }
  const filtered = rows.filter(row => !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase()));
  return <section className="main-column admin-page"><div className="page-heading"><div><span className="eyebrow">LOOKING AFTER YOUR COMMUNITY.</span><h1>Admin desk<span className="heading-dot">.</span></h1><p>A healthy community starts with a little care.</p></div><span className="page-heading-icon"><Icon name="shield" size={26} /></span></div><div className="admin-stats">{[['users','users','Members'],['posts','message','Posts'],['reports','flag','Open reports'],['suspended','shield','Suspended']].map(([key, icon, label]) => <div key={key}><Icon name={icon} size={18} /><strong>{stats[key] === undefined ? '—' : compact(stats[key])}</strong><span>{label}</span></div>)}</div><div className="admin-tabs">{['reports','users','posts','comments','activity'].map(value => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'users' ? 'Members' : value[0].toUpperCase() + value.slice(1)}</button>)}</div><div className="admin-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Filter loaded ${tab}…`} aria-label={`Filter ${tab}`} /><button className="icon-button" aria-label="Refresh admin data" onClick={refresh}><Icon name="refresh" size={17} /></button></div><ErrorBox message={error} onRetry={refresh} />{loading && !rows.length ? <Spinner /> : !filtered.length ? <div className="admin-list"><Empty icon={tab === 'reports' ? 'shield' : 'search'} title={tab === 'reports' ? 'Nothing needs your attention.' : 'Nothing here yet.'} description={search ? 'Try a different filter.' : tab === 'reports' ? 'Reports from your community will appear here.' : 'Community activity will appear as people use BlogDex.'} /></div> : <div className="admin-list">{filtered.map(row => tab === 'users' ? <div key={row.id} className="admin-user-row"><Link to={`/profile/${row.username}`}><Avatar profile={row} /></Link><div className="admin-item-copy"><Link to={`/profile/${row.username}`}><strong>{row.display_name}</strong></Link><span>@{row.username} · {row.email}</span><small>{row.last_sign_in_at ? `Last sign in ${new Date(row.last_sign_in_at).toLocaleString()}` : 'No recorded sign in'}</small></div><span className={`status-pill ${row.is_suspended ? 'status-danger' : 'status-active'}`}>{row.id === profile.id ? 'Admin' : row.is_suspended ? 'Suspended' : 'Active'}</span>{row.id !== profile.id && <button className={`button small-button ${row.is_suspended ? 'secondary' : 'danger-subtle'}`} onClick={() => setAction({ type: 'user', row })}>{row.is_suspended ? 'Restore' : 'Suspend'}</button>}</div>
      : tab === 'posts' ? <div className="admin-post-row" key={row.id}><div className="admin-post-head"><Link to={`/profile/${row.author?.username}`}><Avatar profile={row.author} size="small" /><strong>{row.author?.display_name}</strong><span>@{row.author?.username}</span></Link><span className={`status-pill ${row.removed_at ? 'status-danger' : 'status-active'}`}>{row.removed_at ? 'Hidden' : 'Visible'}</span></div><PostText text={row.body} /><div className="admin-post-foot"><span>{timeAgo(row.created_at)}</span><button className="text-button" onClick={() => setReview(row)}>Review post</button><button className={`button small-button ${row.removed_at ? 'secondary' : 'danger-subtle'}`} onClick={() => setAction({ type: 'post', row })}>{row.removed_at ? 'Restore post' : 'Hide post'}</button></div></div>
      : tab === 'comments' ? <div className="admin-post-row" key={row.id}><div className="admin-post-head"><Link to={`/profile/${row.author?.username}`}><Avatar profile={row.author} size="small" /><strong>{row.author?.display_name}</strong></Link><span>{timeAgo(row.created_at)}</span></div><PostText text={row.body} /><div className="admin-post-foot"><Link className="text-button" to={`/post/${row.post_id}`}>View conversation</Link><button className="button danger-subtle small-button" onClick={() => setAction({ type: 'comment', row })}>Remove comment</button></div></div>
      : tab === 'reports' ? <div key={row.id} className="report-card"><div className="report-heading"><span className={`status-pill ${row.status === 'open' ? 'status-pending' : 'status-active'}`}>{row.status}</span><span>{timeAgo(row.created_at)}</span></div><p className="report-reason">{row.reason}</p><span className="muted">Reported by @{row.reporter?.username}</span>{row.post && <div className="reported-post"><strong>@{row.post.author?.username}</strong><PostText text={row.post.body} /><span className="muted">{row.post.removed_at ? 'Hidden' : 'Visible'}</span></div>}<div className="report-actions"><Link className="text-button" to={`/post/${row.post_id}`}>View post<Icon name="arrow" size={14} /></Link>{row.post && !row.post.removed_at && <button className="button small-button danger-subtle" onClick={() => setAction({ type: 'post', row: row.post })}>Hide post</button>}{row.status === 'open' && <><button className="button small-button secondary" onClick={() => setAction({ type: 'report', row, resolution: 'dismissed' })}>Dismiss</button><button className="button small-button primary" onClick={() => setAction({ type: 'report', row, resolution: 'resolved' })}>Resolve</button></>}</div></div>
      : <div className="audit-row" key={row.id}><span className="audit-icon"><Icon name="shield" size={17} /></span><div><strong>{row.action}</strong><span>Target: {row.target_id}</span></div><time>{new Date(row.created_at).toLocaleString()}</time></div>)}</div>}{rows.length >= limit && <button className="button secondary load-more" disabled={loading} onClick={() => setLimit(value => value + 50)}>Load more</button>}{review && <AdminReview post={review} onClose={() => setReview(null)} />}{action && <Modal title="Confirm moderation action" onClose={() => { if (!busy) setAction(null); }}><div className="modal-body"><p className="muted">{action.type === 'user' ? action.row.is_suspended ? `Restore @${action.row.username}’s access to BlogDex?` : `Suspend @${action.row.username}? Their posts will be hidden and their BlogDex activity will be blocked.` : action.type === 'post' ? action.row.removed_at ? 'Restore this post to the community feed?' : 'Hide this post from the community? You can restore it from the admin desk.' : action.type === 'comment' ? 'Permanently remove this comment?' : `Mark this report as ${action.resolution}?`}</p><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setAction(null)}>Cancel</button><button className="button primary" disabled={busy} onClick={perform}>{busy ? 'Working…' : 'Confirm action'}</button></div></div></Modal>}</section>;
}

function AdminReview({ post, onClose }) {
  return <Modal title="Review post" wide onClose={onClose}><div className="modal-body"><div className="admin-post-head"><strong>@{post.author?.username}</strong><span className="status-pill">{post.removed_at ? 'Hidden' : 'Visible'}</span></div><PostText text={post.body || 'This post has no text.'} /></div></Modal>;
}
