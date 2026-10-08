import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context';
import { check, compact, friendlyError, supabase, timeAgo } from '../lib';
import { Avatar, Empty, ErrorBox, Icon, Modal, PostText, Spinner } from './ui';
import Compose from './Compose';

export default function PostCard({ post: source }) {
  const { profile, isAdmin, refresh, notify } = useApp();
  const [post, setPost] = useState(source);
  const [pending, setPending] = useState('');
  const [modal, setModal] = useState('');
  const [shareLink, setShareLink] = useState('');
  useEffect(() => setPost(source), [source]);
  const author = { id: post.author_id, username: post.username, display_name: post.display_name };
  const own = post.author_id === profile.id;
  async function toggle(kind) {
    if (pending) return;
    setPending(kind);
    const field = kind === 'like' ? 'liked' : 'bookmarked';
    const was = post[field];
    setPost(current => ({ ...current, [field]: !was, ...(kind === 'like' ? { like_count: Number(current.like_count) + (was ? -1 : 1) } : {}) }));
    try {
      const table = kind === 'like' ? 'blogdex_likes' : 'blogdex_bookmarks';
      if (was) check(await supabase.from(table).delete().eq('post_id', post.id).eq('user_id', profile.id));
      else check(await supabase.from(table).insert({ post_id: post.id, user_id: profile.id }));
      if (kind === 'bookmark') notify(was ? 'Removed from your collection.' : 'Saved to your collection.');
      refresh();
    } catch (error) { setPost(source); notify(friendlyError(error), 'error'); }
    finally { setPending(''); }
  }
  async function share() {
    const link = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.display_name} on BlogDex`, text: post.body.slice(0, 150), url: link });
      else if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(link); notify('Post link copied.'); }
      else { setShareLink(link); setModal('share'); }
    } catch (error) { if (error.name !== 'AbortError') { setShareLink(link); setModal('share'); } }
  }
  async function deletePost() {
    setPending('delete');
    try {
      const removed = check(await supabase.from('blogdex_posts').delete().eq('id', post.id).eq('author_id', profile.id).select('id'));
      if (!removed.length) throw new Error('Post not found, or it belongs to another user.');
      refresh(); notify('Post deleted.'); setModal('');
    }
    catch (error) { notify(friendlyError(error), 'error'); }
    finally { setPending(''); }
  }
  async function moderate() {
    setPending('moderate');
    try { check(await supabase.rpc('blogdex_moderate_post', { target_id: post.id, remove_post: true })); refresh(); notify('Post hidden from the community.'); }
    catch (error) { notify(friendlyError(error), 'error'); }
    finally { setPending(''); }
  }
  return <article className="post-card">
    <Link className="post-avatar" to={`/profile/${post.username}`}><Avatar profile={author} /></Link>
    <div className="post-content"><div className="post-heading"><div className="post-byline"><Link className="post-name" to={`/profile/${post.username}`}>{post.display_name}</Link><Link className="post-handle" to={`/profile/${post.username}`}>@{post.username}</Link><span className="post-dot">·</span><Link className="post-time" to={`/post/${post.id}`} title={new Date(post.created_at).toLocaleString()}>{timeAgo(post.created_at)}</Link>{post.updated_at && <span className="edited">edited</span>}</div>
      <details className="post-menu"><summary className="icon-button" aria-label="Post options"><Icon name="more" size={19} /></summary><div className="dropdown">
        <button onClick={share}><Icon name="link" size={16} /> Copy post link</button>
        {own && <><button onClick={() => setModal('edit')}><Icon name="edit" size={16} /> Edit post</button><button className="danger-text" onClick={() => setModal('delete')}><Icon name="trash" size={16} /> Delete post</button></>}
        {!own && <button onClick={() => setModal('report')}><Icon name="flag" size={16} /> Report post</button>}
        {isAdmin && <button className="danger-text" disabled={!!pending} onClick={moderate}><Icon name="shield" size={16} /> Hide as admin</button>}
      </div></details></div>
      {post.body && <PostText text={post.body} />}
      <div className="post-actions"><button className="post-action comment-action" onClick={() => setModal('comments')} aria-label={`${post.comment_count} comments`}><Icon name="message" size={18} /><span>{compact(post.comment_count)}</span></button><button className={`post-action like-action ${post.liked ? 'is-liked' : ''}`} disabled={!!pending} onClick={() => toggle('like')} aria-label={post.liked ? 'Unlike post' : 'Like post'} aria-pressed={post.liked}><Icon name="heart" size={18} fill={post.liked ? 'currentColor' : 'none'} /><span>{compact(post.like_count)}</span></button><button className={`post-action bookmark-action ${post.bookmarked ? 'is-bookmarked' : ''}`} disabled={!!pending} onClick={() => toggle('bookmark')} aria-label={post.bookmarked ? 'Remove bookmark' : 'Bookmark post'} aria-pressed={post.bookmarked}><Icon name="bookmark" size={17} fill={post.bookmarked ? 'currentColor' : 'none'} /></button><button className="post-action share-action" onClick={share} aria-label="Share post"><Icon name="share" size={17} /></button></div>
    </div>
    {modal === 'edit' && <Compose post={post} onClose={() => setModal('')} />}
    {modal === 'comments' && <Comments post={post} onClose={() => setModal('')} />}
    {modal === 'report' && <Report post={post} onClose={() => setModal('')} />}
    {modal === 'share' && <Modal title="Share this post" onClose={() => setModal('')}><div className="modal-body"><p className="muted">Copy this link to share the post.</p><input readOnly value={shareLink} onFocus={event => event.target.select()} aria-label="Post link" /></div></Modal>}
    {modal === 'delete' && <Modal title="Delete this post?" onClose={() => { if (!pending) setModal(''); }}><div className="modal-body"><p className="muted">Your post, comments, and likes will be permanently removed.</p><div className="modal-actions"><button className="button secondary" disabled={!!pending} onClick={() => setModal('')}>Keep it</button><button className="button danger" disabled={!!pending} onClick={deletePost}>{pending ? 'Deleting…' : 'Delete post'}</button></div></div></Modal>}
  </article>;
}

function Comments({ post, onClose }) {
  const { profile, isAdmin, refresh, notify } = useApp();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(30);
  async function load() {
    setError('');
    try { setComments(check(await supabase.from('blogdex_comments').select('*,author:blogdex_profiles!blogdex_comments_author_id_fkey(*)').eq('post_id', post.id).order('created_at', { ascending: false }).limit(limit)).reverse()); }
    catch (error) { setError(friendlyError(error)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [post.id, limit]);
  async function submit(event) {
    event.preventDefault(); if (!body.trim() || busy) return;
    setBusy(true); setError('');
    try { check(await supabase.from('blogdex_comments').insert({ post_id: post.id, author_id: profile.id, body: body.trim() })); setBody(''); await load(); refresh(); }
    catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true);
    try { check(await supabase.from('blogdex_comments').delete().eq('id', id)); await load(); refresh(); notify('Comment removed.'); }
    catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  return <Modal title="The conversation" onClose={onClose} wide><div className="modal-body"><div className="comment-original"><strong>{post.display_name}</strong><PostText text={post.body} /></div><ErrorBox message={error} onRetry={load} /><div className="comments-list">{loading ? <Spinner /> : !comments.length ? <Empty title="Start the conversation." description="A little reply can go a long way." /> : comments.map(comment => <div className="comment" key={comment.id}><Link to={`/profile/${comment.author?.username}`} onClick={onClose}><Avatar profile={comment.author} size="small" /></Link><div className="comment-copy"><div><Link to={`/profile/${comment.author?.username}`} onClick={onClose}><strong>{comment.author?.display_name || 'Member'}</strong></Link><span className="muted"> · {timeAgo(comment.created_at)}</span></div><PostText text={comment.body} /></div>{(comment.author_id === profile.id || isAdmin) && <button className="icon-button danger-text" disabled={busy} aria-label="Delete comment" onClick={() => remove(comment.id)}><Icon name="trash" size={15} /></button>}</div>)}</div>{comments.length >= limit && <button className="text-button" onClick={() => setLimit(value => value + 30)}>Load more replies</button>}<form className="comment-form" onSubmit={submit}><Avatar profile={profile} size="small" /><label className="sr-only" htmlFor="comment-body">Your reply</label><input id="comment-body" value={body} onChange={event => setBody(event.target.value)} maxLength={500} placeholder="Add to the conversation…" required /><button className="button primary" disabled={busy || !body.trim()} aria-label="Send reply"><Icon name="send" size={17} /></button></form></div></Modal>;
}

function Report({ post, onClose }) {
  const { profile, notify, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true);
    try { check(await supabase.from('blogdex_reports').insert({ post_id: post.id, reporter_id: profile.id, reason: String(form.get('reason')).trim() })); notify('Report sent to the BlogDex admin.'); refresh(); onClose(); }
    catch (error) { setError(error.code === '23505' ? 'You have already reported this post.' : friendlyError(error)); }
    finally { setBusy(false); }
  }
  return <Modal title="Report this post" onClose={onClose}><form className="form-stack modal-body" onSubmit={submit}><p className="muted">Tell the admin what needs attention. Your report is only visible to you and the admin.</p><label>What’s the issue?<textarea name="reason" required minLength={5} maxLength={500} rows={4} placeholder="Spam, harassment, inappropriate content…" /></label><ErrorBox message={error} /><button className="button primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}<Icon name="flag" size={16} /></button></form></Modal>;
}
