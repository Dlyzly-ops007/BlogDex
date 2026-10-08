import { useState } from 'react';
import { Avatar, ErrorBox, Icon, Modal } from './ui';
import { check, friendlyError, supabase } from '../lib';
import { useApp } from '../context';

export default function Compose({ onClose, post = null }) {
  const { profile, refresh, notify } = useApp();
  const [body, setBody] = useState(post?.body || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const text = body.trim();
      if (!text) throw new Error('Write something to post.');
      if ([...text].length > 1000) throw new Error('Posts can contain up to 1,000 characters.');
      if (!post) {
        // No .select() here: asking for the new row back is rejected by the posts read policy.
        check(await supabase.from('blogdex_posts').insert({ author_id: profile.id, body: text }));
      } else {
        // Match the version we loaded so a concurrent edit is never silently overwritten.
        let query = supabase.from('blogdex_posts').update({ body: text }).eq('id', post.id).eq('author_id', profile.id).eq('body', post.body);
        query = post.updated_at ? query.eq('updated_at', post.updated_at) : query.is('updated_at', null);
        const saved = check(await query.select('id'));
        if (!saved.length) throw new Error('Could not save. The post may have changed in another window, or your account may be restricted. Refresh and try again.');
      }
      refresh(); notify(post ? 'Post updated.' : 'Your thought is out there.'); onClose();
    } catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  const length = [...body].length;
  return <Modal title={post ? 'Edit your post' : 'Share a thought'} onClose={() => { if (!busy) onClose(); }} wide>
    <form className="compose-form" onSubmit={submit}>
      <div className="compose-author"><Avatar profile={profile} /><div><strong>{profile.display_name}</strong><span className="audience"><Icon name="users" size={13} /> Your community · Public post</span></div></div>
      <label className="sr-only" htmlFor="compose-body">Post text</label><textarea id="compose-body" className="compose-textarea" autoFocus required rows={5} placeholder="What’s on your mind?" value={body} onChange={event => setBody(event.target.value)} disabled={busy} />
      <ErrorBox message={error} />
      <div className="compose-toolbar"><div className="compose-tools"><button type="button" className="icon-button accent" aria-label="Add a smile" disabled={busy} onClick={() => setBody(text => text + ' 😊')}><Icon name="smile" /></button><span className="compose-limit">Text-only · Keep it thoughtful.</span></div><div className="compose-actions"><span className={`character-count ${length > 1000 ? 'over-limit' : ''}`}>{length}<span> / 1,000</span></span><button className="button primary" disabled={busy || length > 1000 || !body.trim()}>{busy ? 'Saving…' : post ? 'Save changes' : 'Post'}<Icon name="send" size={15} /></button></div></div>
    </form>
  </Modal>;
}
