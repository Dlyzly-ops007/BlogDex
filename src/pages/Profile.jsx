import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context';
import { check, compact, friendlyError, supabase } from '../lib';
import { Avatar, Empty, ErrorBox, Icon, Modal, Spinner } from '../components/ui';
import { Feed } from './Feed';

export default function Profile() {
  const { username } = useParams();
  const { profile, version, following, toggleFollow } = useApp();
  const [person, setPerson] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [list, setList] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    (async () => {
      try { const data = check(await supabase.from('blogdex_people').select('*').eq('username', username.toLowerCase()).maybeSingle()); if (!cancelled) setPerson(data); }
      catch (error) { if (!cancelled) setError(friendlyError(error)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [username, version]);
  const own = person?.id === profile.id;
  async function follow() { setBusy(true); await toggleFollow(person.id); setBusy(false); }
  if (loading && !person) return <section className="main-column"><Spinner label="Opening this little corner…" /><ErrorBox message={error} /></section>;
  if (!person) return <section className="main-column"><ErrorBox message={error} /><Empty icon="user" title="Profile not found." description="This account may not exist or may be suspended."><Link className="button secondary" to="/">Back home</Link></Empty></section>;
  return <section className="main-column"><div className="profile-top"><Link className="icon-button" to="/" aria-label="Back home"><Icon name="back" /></Link><div><h2>{person.display_name}</h2><span>{compact(person.post_count)} posts</span></div></div><ErrorBox message={error} /><div className="profile-card"><div className="profile-cover"><span className="cover-quote">A little corner of the internet.</span><i /><i /><i /></div><div className="profile-info"><div className="profile-avatar-row"><Avatar profile={person} size="large" />{own ? <button className="button secondary" onClick={() => setEditing(true)}><Icon name="edit" size={15} /> Edit profile</button> : <button className={`button ${following.has(person.id) ? 'secondary' : 'primary'}`} disabled={busy} onClick={follow}><Icon name={following.has(person.id) ? 'check' : 'plus'} size={16} />{following.has(person.id) ? 'Following' : 'Follow'}</button>}</div><h1>{person.display_name}</h1><p className="profile-username">@{person.username}</p>{person.bio && <p className="profile-bio">{person.bio}</p>}<div className="profile-meta">{person.location && <span><Icon name="map" size={15} />{person.location}</span>}{/^https?:\/\//.test(person.website) && <a href={person.website} target="_blank" rel="noopener noreferrer"><Icon name="link" size={15} />{person.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>}<span><Icon name="calendar" size={15} />Joined {new Date(person.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div><div className="profile-counts"><button onClick={() => setList('following')}><strong>{compact(person.following_count)}</strong> Following</button><button onClick={() => setList('followers')}><strong>{compact(person.follower_count)}</strong> Followers</button><span><strong>{compact(person.post_count)}</strong> Posts</span></div></div></div><div className="profile-posts-head"><h2>Thoughts & moments</h2><Icon name="grid" size={16} /></div><Feed key={person.id} authorId={person.id} />{editing && <EditProfile person={person} onClose={() => setEditing(false)} />}{list && <FollowList person={person} kind={list} onClose={() => setList('')} />}</section>;
}

function EditProfile({ person, onClose }) {
  const { refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const input = Object.fromEntries(['display_name','bio','location','website'].map(name => [name, String(form.get(name) || '').trim()]));
      if (input.website) {
        try { const website = new URL(/^https?:\/\//i.test(input.website) ? input.website : `https://${input.website}`); if (!['http:','https:'].includes(website.protocol)) throw new Error(); input.website = website.href; }
        catch { throw new Error('Enter a valid website address.'); }
      }
      check(await supabase.from('blogdex_profiles').update(input).eq('id', person.id).select('id').single());
      refresh(); notify('Profile updated.'); onClose();
    } catch (error) { setError(friendlyError(error)); refresh(); }
    finally { setBusy(false); }
  }
  return <Modal title="Make it yours" onClose={() => { if (!busy) onClose(); }}><form className="form-stack modal-body" onSubmit={submit}><div className="profile-edit-avatar"><Avatar profile={person} size="large" /><span className="muted">Your initials are your profile picture.</span></div><label>Display name<input name="display_name" defaultValue={person.display_name} maxLength={50} required /></label><label>Bio<textarea name="bio" defaultValue={person.bio} maxLength={160} rows={3} placeholder="Tell your story in a few words." /></label><label>Location<input name="location" defaultValue={person.location} maxLength={60} placeholder="Your little part of the world" /></label><label>Website<input name="website" defaultValue={person.website} maxLength={300} placeholder="https://your-website.com" /></label><ErrorBox message={error} /><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}<Icon name="check" size={17} /></button></form></Modal>;
}

function FollowList({ person, kind, onClose }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const field = kind === 'followers' ? 'follower_id' : 'following_id';
        const filter = kind === 'followers' ? 'following_id' : 'follower_id';
        const rows = check(await supabase.from('blogdex_follows').select(`${field},person:blogdex_profiles!blogdex_follows_${field}_fkey(*)`).eq(filter, person.id).order('created_at', { ascending: false }).limit(limit));
        if (!cancelled) setPeople(rows.filter(row => row.person).map(row => row.person));
      } catch (error) { if (!cancelled) setError(friendlyError(error)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [person.id, kind, limit]);
  return <Modal title={kind === 'followers' ? 'Followers' : 'Following'} onClose={onClose}><div className="modal-body"><ErrorBox message={error} />{loading ? <Spinner /> : people.length ? people.map(person => <Link className="user-list-row" to={`/profile/${person.username}`} key={person.id} onClick={onClose}><Avatar profile={person} /><div><strong>{person.display_name}</strong><span>@{person.username}</span></div><Icon name="chevron" size={17} /></Link>) : <Empty icon="users" title="Connections will grow here." description="Every friendship starts with a follow." />}{people.length >= limit && <button className="text-button" onClick={() => setLimit(value => value + 50)}>Show more</button>}</div></Modal>;
}
