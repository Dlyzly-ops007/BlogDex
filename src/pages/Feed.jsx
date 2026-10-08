import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useApp } from '../context';
import { check, friendlyError, supabase } from '../lib';
import { Avatar, Empty, ErrorBox, Icon, Spinner } from '../components/ui';
import PostCard from '../components/PostCard';

export function Feed({ kind = 'home', authorId = null, postId = null, search = '' }) {
  const { version, following, openCompose } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  const [retry, setRetry] = useState(0);
  const followingKey = [...following].sort().join(',');
  useEffect(() => { setLimit(30); setPosts([]); }, [kind, authorId, postId, search]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try {
        if (kind === 'following' && !followingKey) { setPosts([]); return; }
        let query = supabase.from('blogdex_feed').select('*').neq('body', '').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
        if (authorId) query = query.eq('author_id', authorId);
        if (postId) query = query.eq('id', postId);
        if (kind === 'collections') query = query.eq('bookmarked', true);
        if (kind === 'following') query = query.in('author_id', followingKey.split(','));
        if (search.trim()) query = query.textSearch('search_document', search.trim(), { type: 'websearch', config: 'simple' });
        const data = check(await query);
        if (!cancelled) setPosts(data);
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [kind, authorId, postId, search, version, followingKey, limit, retry]);
  const empty = kind === 'following' ? { icon: 'users', title: 'Your people are out there.', description: 'Follow someone to bring their thoughts into this feed.' }
    : kind === 'collections' ? { icon: 'bookmark', title: 'Keep the good stuff close.', description: 'Tap the bookmark on a post to save it here. Your collection is just for you.' }
    : postId ? { icon: 'message', title: 'This post isn’t here.', description: 'It may have been deleted or hidden by the admin.' }
    : search ? { icon: 'search', title: 'No posts found.', description: 'Try another word, a username, or a topic.' }
    : authorId ? { icon: 'edit', title: 'A story waiting to start.', description: 'Posts shared by this profile will appear here.' }
    : { icon: 'message', title: 'Every community starts with a hello.', description: 'Share a thought or a little moment. Make the first post yours.' };
  return <div className="feed-list"><ErrorBox message={error} onRetry={() => setRetry(value => value + 1)} />{loading && !posts.length ? <Spinner label="Finding your moments…" /> : !posts.length && !error ? <Empty {...empty}>{kind === 'following' ? <Link className="button primary" to="/explore">Find your people<Icon name="arrow" size={16} /></Link> : !search && !authorId && !postId && kind !== 'collections' ? <button className="button primary" onClick={openCompose}>Share your first moment<Icon name="plus" size={17} /></button> : null}</Empty> : posts.map(post => <PostCard key={post.id} post={post} />)}{!postId && posts.length >= limit && <button className="button secondary load-more" disabled={loading} onClick={() => setLimit(value => value + 30)}>{loading ? 'Loading…' : 'A little more'}<Icon name="arrow" size={16} /></button>}</div>;
}

export default function FeedPage() {
  const { profile, openCompose } = useApp();
  const location = useLocation();
  const [params] = useSearchParams();
  const search = params.get('q') || '';
  const kind = location.pathname === '/following' ? 'following' : location.pathname === '/collections' ? 'collections' : location.pathname === '/explore' ? 'explore' : 'home';
  return <section className="main-column"><div className="page-heading"><div><span className="eyebrow">YOUR THOUGHTS, CONNECTED.</span><h1>{kind === 'collections' ? 'Collections' : kind === 'explore' ? 'Explore' : 'Home'}<span className="heading-dot">.</span></h1><p>{kind === 'collections' ? 'A place for the posts you want to come back to.' : kind === 'explore' ? search ? `Discovering “${search}”` : 'Fresh perspectives. New connections.' : 'A little of everything, from everyone.'}</p></div><span className="page-heading-icon"><Icon name={kind === 'collections' ? 'bookmark' : kind === 'explore' ? 'search' : 'home'} size={25} /></span></div>
    {['home','following'].includes(kind) && <><div className="feed-tabs"><Link className={kind === 'home' ? 'active' : ''} to="/">For you</Link><Link className={kind === 'following' ? 'active' : ''} to="/following">Following</Link><span>GOOD THOUGHTS LIVE HERE</span></div><div className="quick-compose"><Avatar profile={profile} /><button className="quick-compose-prompt" onClick={openCompose}>What’s on your mind, {profile.display_name.split(' ')[0]}?</button><button className="button primary compact-button" onClick={openCompose}>Post<Icon name="plus" size={15} /></button></div></>}
    {kind === 'explore' && <People search={search} />}
    {kind === 'collections' && <div className="collection-note"><Icon name="bookmark" size={17} /><span>Saved by you. Only visible to you.</span></div>}
    {kind === 'explore' && <div className="section-heading"><h2>{search ? 'Matching posts' : 'From the community'}</h2><span>Latest first</span></div>}
    <Feed key={`${kind}:${search}`} kind={kind} search={search} />
  </section>;
}

function People({ search }) {
  const { profile, version, following, toggleFollow } = useApp();
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let query = supabase.from('blogdex_people').select('*').neq('id', profile.id).eq('is_suspended', false).order('created_at', { ascending: false }).limit(12);
        if (search.trim()) query = query.textSearch('search_document', search.replace(/^[@#]/, '').trim(), { type: 'websearch', config: 'simple' });
        const data = check(await query);
        if (!cancelled) { setPeople(data); setError(''); }
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
    })();
    return () => { cancelled = true; };
  }, [search, profile.id, version]);
  async function follow(id) { setBusy(id); await toggleFollow(id); setBusy(''); }
  return <div className="explore-people"><div className="section-heading"><h2>{search ? 'People' : 'Meet the community'}</h2><Icon name="users" size={17} /></div><ErrorBox message={error} />{people.length ? <div className="people-grid">{people.map(person => <div className="people-card" key={person.id}><Link to={`/profile/${person.username}`}><Avatar profile={person} /><strong>{person.display_name}</strong><span>@{person.username}</span></Link><p>{person.bio || 'A new voice in the community.'}</p><button className={`button ${following.has(person.id) ? 'secondary' : 'primary'}`} disabled={!!busy} onClick={() => follow(person.id)}>{following.has(person.id) ? 'Following' : 'Follow'}<Icon name={following.has(person.id) ? 'check' : 'plus'} size={14} /></button></div>)}</div> : <div className="small-empty">{search ? 'No matching profiles yet.' : 'As people join BlogDex, you’ll find them here.'}</div>}</div>;
}
