import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppContext, useApp } from './context';
import { check, compact, friendlyError, supabase } from './lib';
import { Avatar, Brand, Empty, ErrorBox, Icon, Modal, Spinner } from './components/ui';
import Compose from './components/Compose';
import Auth, { ProfileSetup } from './pages/Auth';
import FeedPage, { Feed } from './pages/Feed';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import { initializeAuth } from '../shared/auth.mjs';

export default function App() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [following, setFollowing] = useState(new Set());
  const [unread, setUnread] = useState(0);
  const [version, setVersion] = useState(0);
  const [bootstrapError, setBootstrapError] = useState('');
  const [compose, setCompose] = useState(false);
  const [recovery, setRecovery] = useState(window.location.hash.includes('type=recovery'));
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'dark');
  const toastTimer = useRef(null);
  const startupAuth = useRef(null);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  const notify = useCallback((message, type = 'success') => {
    clearTimeout(toastTimer.current); setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('blogdex-theme', theme); } catch { /* Browser storage may be disabled. */ }
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0b0d14' : '#f8f9fc';
  }, [theme]);
  const toggleTheme = () => setTheme(value => value === 'dark' ? 'light' : 'dark');
  useEffect(() => {
    let cancelled = false;
    // StrictMode repeats effects; consume a confirmation token only once.
    if (!startupAuth.current) startupAuth.current = initializeAuth(supabase.auth, window.location.href);
    startupAuth.current.then(({ session, recovery, cleanUrl }) => {
      if (cancelled) return;
      setSession(session);
      if (recovery && session) setRecovery(true);
      window.history.replaceState(window.history.state, '', cleanUrl);
    }).catch(error => { if (!cancelled) { setSession(null); window.history.replaceState(window.history.state, '', window.location.pathname); notify(friendlyError(error), 'error'); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setProfile(undefined); setCompose(false); setRecovery(false); }
    });
    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(toastTimer.current); };
  }, [notify]);
  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setBootstrapError('');
    (async () => {
      try {
        const current = check(await supabase.from('blogdex_profiles').select('*').eq('id', userId).maybeSingle());
        if (cancelled) return;
        setProfile(current);
        if (!current) return;
        const results = await Promise.all([
          supabase.rpc('blogdex_is_admin'),
          supabase.from('blogdex_follows').select('following_id').eq('follower_id', userId),
          supabase.from('blogdex_notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).is('read_at', null),
        ]);
        if (cancelled) return;
        setIsAdmin(Boolean(check(results[0])));
        setFollowing(new Set(check(results[1]).map(row => row.following_id)));
        check(results[2]); setUnread(results[2].count || 0);
      } catch (error) { if (!cancelled) setBootstrapError(friendlyError(error)); }
    })();
    return () => { cancelled = true; };
  }, [userId, version]);
  useEffect(() => {
    if (!userId) return;
    let timer;
    const channel = supabase.channel(`blogdex-${userId}`);
    for (const table of ['blogdex_profiles','blogdex_posts','blogdex_likes','blogdex_comments','blogdex_follows','blogdex_bookmarks','blogdex_notifications','blogdex_reports']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(timer); timer = setTimeout(refresh, 250); });
    }
    channel.subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [userId, refresh]);
  async function signOut() {
    try { check(await supabase.auth.signOut()); }
    catch (error) { notify(friendlyError(error), 'error'); }
  }
  async function toggleFollow(id) {
    const wasFollowing = following.has(id);
    setFollowing(current => { const next = new Set(current); wasFollowing ? next.delete(id) : next.add(id); return next; });
    try {
      if (wasFollowing) check(await supabase.from('blogdex_follows').delete().eq('follower_id', profile.id).eq('following_id', id));
      else check(await supabase.from('blogdex_follows').insert({ follower_id: profile.id, following_id: id }));
      refresh();
    } catch (error) {
      setFollowing(current => { const next = new Set(current); wasFollowing ? next.add(id) : next.delete(id); return next; });
      notify(friendlyError(error), 'error');
    }
  }
  const value = { session, profile, isAdmin, following, unread, version, refresh, notify, toggleFollow, openCompose: () => setCompose(true), signOut, theme, toggleTheme };
  let content;
  if (session === undefined) content = <div className="splash"><Brand /><Spinner label="A little connection is on its way…" /></div>;
  else if (!session) content = <Auth theme={theme} toggleTheme={toggleTheme} />;
  else if (bootstrapError && (!profile || profile.id !== userId)) content = <main className="setup-page"><Brand /><div className="setup-card"><span className="auth-mark"><Icon name="link" /></span><h1>Let’s connect BlogDex.</h1><ErrorBox message={bootstrapError} /><p className="muted">The setup instructions are in this project’s README.</p><button className="button primary" onClick={refresh}><Icon name="refresh" size={16} />Try again</button><button className="text-button auth-back" onClick={signOut}>Sign out</button></div></main>;
  else if (profile === undefined || (profile && profile.id !== userId)) content = <div className="splash"><Brand /><Spinner label="Opening your space…" /></div>;
  else if (!profile) content = <ProfileSetup user={session.user} onComplete={refresh} onSignOut={signOut} />;
  else if (profile.is_suspended) content = <main className="setup-page"><Brand /><div className="setup-card"><Empty icon="shield" title="Your account is suspended." description="The BlogDex admin has paused this account’s access. Contact the site owner for a review." /><button className="button secondary" onClick={refresh}>Check account status</button><button className="text-button auth-back" onClick={signOut}>Sign out</button></div></main>;
  else content = <AppContext.Provider value={value}><Shell bootstrapError={bootstrapError} />{compose && <Compose onClose={() => setCompose(false)} />}</AppContext.Provider>;
  return <>{content}{recovery && session && <PasswordRecovery onClose={() => setRecovery(false)} notify={notify} />}{toast && <div role={toast.type === 'error' ? 'alert' : 'status'} className={`toast toast-${toast.type}`}><Icon name={toast.type === 'error' ? 'warning' : 'check'} size={18} /><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setToast(null)}><Icon name="x" size={15} /></button></div>}</>;
}

function Shell({ bootstrapError }) {
  const { isAdmin, profile, refresh } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setSidebarOpen(false); window.scrollTo({ top: 0 }); }, [location.pathname]);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close);
  }, []);
  return <div className="app-shell"><a href="#main-content" className="skip-link">Skip to content</a>{sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="app-body"><Header onMenu={() => setSidebarOpen(value => !value)} /><div className="content-layout"><main id="main-content" className="main-wrap"><ErrorBox message={bootstrapError} onRetry={refresh} /><Routes><Route path="/" element={<FeedPage />} /><Route path="/following" element={<FeedPage />} /><Route path="/explore" element={<FeedPage />} /><Route path="/collections" element={<FeedPage />} /><Route path="/notifications" element={<Notifications />} /><Route path="/profile/:username" element={<Profile />} /><Route path="/profile" element={<Navigate to={`/profile/${profile.username}`} replace />} /><Route path="/post/:id" element={<SinglePost />} /><Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" replace />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes><footer className="feed-footer">A little less noise. A little more connection.<span>BlogDex</span></footer></main><CommunityPanels /></div></div><MobileNav /></div>;
}

function Sidebar({ open, onClose }) {
  const { profile, isAdmin, openCompose, signOut, theme, toggleTheme } = useApp();
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Main navigation"><div className="sidebar-brand"><Brand /><button className="icon-button mobile-only" onClick={onClose} aria-label="Close navigation"><Icon name="x" /></button></div><span className="brand-tagline">A thought. A moment. A connection.</span><Link className="sidebar-profile" to={`/profile/${profile.username}`}><Avatar profile={profile} /><div><strong>{profile.display_name}</strong><span>@{profile.username}</span></div><Icon name="chevron" size={15} /></Link><button className="button primary new-post-button" onClick={() => { onClose(); openCompose(); }}><Icon name="plus" size={20} /> Create a post</button><span className="nav-label">YOUR SPACE</span><nav className="sidebar-nav"><NavLink to="/" end><Icon name="home" /><span>Home</span></NavLink><NavLink to="/explore"><Icon name="search" /><span>Explore</span></NavLink><NavLink to="/collections"><Icon name="bookmark" /><span>Collections</span></NavLink><NavLink to="/notifications"><Icon name="bell" /><span>Notifications</span></NavLink><NavLink to={`/profile/${profile.username}`}><Icon name="user" /><span>My profile</span></NavLink>{isAdmin && <NavLink className="admin-nav" to="/admin"><Icon name="shield" /><span>Admin desk</span><i /></NavLink>}</nav><div className="sidebar-bottom"><div className="theme-switch"><Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} /><span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span><button role="switch" aria-checked={theme === 'dark'} aria-label="Dark mode" onClick={toggleTheme}><i /></button></div><button className="logout-button" onClick={signOut}><Icon name="logout" size={18} />Log out</button><div className="sidebar-footer"><span className="little-dot" /> Small thoughts, infinite possibilities.<span>© {new Date().getFullYear()} BlogDex</span></div></div></aside>;
}

function Header({ onMenu }) {
  const { profile, unread, theme, toggleTheme } = useApp();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const navigate = useNavigate();
  const input = useRef(null);
  useEffect(() => setSearch(params.get('q') || ''), [params]);
  useEffect(() => {
    const listener = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.current?.focus(); } };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener);
  }, []);
  return <header className="topbar"><button className="icon-button mobile-only menu-button" aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button><form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); navigate(`/explore${search.trim() ? `?q=${encodeURIComponent(search.trim().replace(/^[@#]/, ''))}` : ''}`); }}><button type="submit" className="icon-button" aria-label="Search"><Icon name="search" size={19} /></button><input ref={input} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search thoughts, people, #topics…" aria-label="Search BlogDex" maxLength={100} /><span className="search-shortcut"><kbd>Ctrl</kbd><kbd>K</kbd></span></form><div className="topbar-actions"><button className="icon-button theme-top" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button><Link className="icon-button notification-button" to="/notifications" aria-label={`Notifications, ${unread} unread`}><Icon name="bell" size={22} />{unread > 0 && <i />}</Link><Link className="topbar-avatar" to={`/profile/${profile.username}`} aria-label="Your profile"><Avatar profile={profile} size="small" /></Link></div></header>;
}

function CommunityPanels() {
  const { profile, following, version, toggleFollow } = useApp();
  const [trends, setTrends] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const followingKey = [...following].join(',');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let query = supabase.from('blogdex_profiles').select('*').neq('id', profile.id).eq('is_suspended', false).order('created_at', { ascending: false }).limit(3);
        if (followingKey) query = query.not('id', 'in', `(${followingKey})`);
        const results = await Promise.all([supabase.from('blogdex_trending').select('*').limit(5), query]);
        const tags = check(results[0]); const users = check(results[1]);
        if (!cancelled) { setTrends(tags); setPeople(users); setError(''); }
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
    })();
    return () => { cancelled = true; };
  }, [profile.id, version, followingKey]);
  async function follow(id) { setBusy(id); await toggleFollow(id); setBusy(''); }
  return <aside className="right-column" aria-label="Discover the community"><ErrorBox message={error} /><section className="side-card trending-card"><div className="side-card-heading"><h2><span className="fire-icon"><Icon name="fire" size={18} /></span>Trending topics</h2><span className="mini-badge">THIS WEEK</span></div>{trends.length ? <div className="trending-list">{trends.map((trend, index) => <Link to={`/explore?q=${encodeURIComponent(trend.tag)}`} key={trend.tag}><span className="trend-rank">{String(index + 1).padStart(2, '0')}</span><strong>#{trend.tag}</strong><span>{compact(trend.post_count)} {Number(trend.post_count) === 1 ? 'post' : 'posts'}</span></Link>)}</div> : <div className="side-empty"><Icon name="fire" size={26} /><p>A conversation starts with a spark.</p><span>Use #hashtags in your posts to get a topic going.</span></div>}<Link className="side-more" to="/explore">Explore topics<Icon name="arrow" size={15} /></Link></section><section className="side-card"><div className="side-card-heading"><h2><Icon name="users" size={18} />People to follow</h2></div>{people.length ? <div className="suggested-list">{people.map(person => <div className="suggested-user" key={person.id}><Link to={`/profile/${person.username}`}><Avatar profile={person} size="small" /></Link><Link className="suggested-info" to={`/profile/${person.username}`}><strong>{person.display_name}</strong><span>@{person.username}</span><p>{person.bio || 'New to BlogDex'}</p></Link><button className="follow-button" disabled={!!busy} onClick={() => follow(person.id)}>{busy === person.id ? '…' : 'Follow'}</button></div>)}</div> : <div className="side-empty"><Icon name="users" size={27} /><p>Good company is on its way.</p><span>New people to follow will appear as the community grows.</span></div>}<Link className="side-more" to="/explore">Find your people<Icon name="arrow" size={15} /></Link></section><section className="community-note"><span className="note-spark">✦</span><h3>Small posts.<br />Big possibilities.</h3><p>Share something that made you think, smile, or see things a little differently.</p><span className="note-signature">That’s the BlogDex way.</span></section><div className="right-footer"><Link to="/explore">Explore</Link><Link to={`/profile/${profile.username}`}>Your profile</Link><span>© {new Date().getFullYear()} BlogDex</span></div></aside>;
}

function MobileNav() {
  const { profile, openCompose, unread } = useApp();
  return <nav className="mobile-nav" aria-label="Mobile navigation"><NavLink to="/" end aria-label="Home"><Icon name="home" /></NavLink><NavLink to="/explore" aria-label="Explore"><Icon name="search" /></NavLink><button className="mobile-compose" onClick={openCompose} aria-label="Create post"><Icon name="plus" size={25} /></button><NavLink className="notification-button" to="/notifications" aria-label="Notifications"><Icon name="bell" />{unread > 0 && <i />}</NavLink><NavLink to={`/profile/${profile.username}`} aria-label="My profile"><Icon name="user" /></NavLink></nav>;
}

function SinglePost() {
  const { id } = useParams();
  return <section className="main-column"><div className="profile-top"><Link className="icon-button" to="/" aria-label="Back home"><Icon name="back" /></Link><div><h2>A thought, shared.</h2><span>Join the conversation.</span></div></div><Feed key={id} postId={id} /></section>;
}

function PasswordRecovery({ onClose, notify }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    if (form.get('password') !== form.get('confirm')) { setBusy(false); setError('The passwords do not match.'); return; }
    try { check(await supabase.auth.updateUser({ password: String(form.get('password')) })); notify('Your password has been updated.'); onClose(); }
    catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  return <Modal title="Choose a new password" onClose={onClose}><form className="form-stack modal-body" onSubmit={submit}><label>New password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label><label>Confirm password<input name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label><ErrorBox message={error} /><button className="button primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></Modal>;
}
