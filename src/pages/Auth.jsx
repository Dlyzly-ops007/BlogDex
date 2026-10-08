import { useRef, useState } from 'react';
import { Brand, Icon, ErrorBox } from '../components/ui';
import { supabase, check, friendlyError } from '../lib';

export default function Auth({ theme, toggleTheme }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');
  const emailInput = useRef(null);
  const loginPanel = useRef(null);
  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';
  function changeMode(value) { setMode(value); setError(''); setMessage(''); setConfirmationEmail(''); }
  async function resendConfirmation() {
    const email = emailInput.current?.value.trim();
    if (!email || !emailInput.current.checkValidity()) { emailInput.current?.reportValidity(); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      check(await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: new URL('/auth/confirm', window.location.origin).href } }));
      setMessage('A new confirmation link was requested. Use the newest email, then return here to log in.');
      setConfirmationEmail(email);
    } catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  function openLogin() {
    changeMode('login');
    loginPanel.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    emailInput.current?.focus({ preventScroll: true });
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password') || '');
    try {
      if (isReset) {
        check(await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL('/auth/confirm', window.location.origin).href }));
        setMessage('If this email has an account, a password reset link will arrive shortly. Check your spam folder too.');
      } else if (isSignup) {
        const username = String(form.get('username')).trim().toLowerCase();
        const display_name = String(form.get('display_name')).trim();
        if (!/^[a-z0-9_]{3,24}$/.test(username)) throw new Error('Use 3–24 lowercase letters, numbers, or underscores for your username.');
        const data = check(await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL('/auth/confirm', window.location.origin).href, data: { app: 'blogdex', username, display_name } } }));
        if (!data.session) { setConfirmationEmail(email); setMessage('Check your email to confirm your account, then come back and sign in to finish your profile.'); }
      } else check(await supabase.auth.signInWithPassword({ email, password }));
    } catch (error) {
      if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message)) setConfirmationEmail(email);
      setError(friendlyError(error));
    }
    finally { setBusy(false); }
  }
  return <main className={`auth-page ${isSignup ? 'auth-signup' : ''}`}>
    <section className="auth-story">
      <Brand />
      <div className="story-content">
        <h1>Welcome to<span className="welcome-wordmark"><img src="/brand-logo.svg" alt="BlogDex" width="554" height="160" /></span></h1>
        <p>Share your thoughts with<br />the world!</p>
        <div className="welcome-doodles" aria-hidden="true"><Icon name="message" size={30} /><Icon name="send" size={25} /><Icon name="message" size={34} /></div>
        <button className="button welcome-login" onClick={openLogin} disabled={busy}>Click Here to Login</button>
      </div>
      <span className="story-footer">A thought. A moment. A connection.</span>
    </section>
    <section className="auth-form-side" ref={loginPanel} aria-labelledby="auth-heading">
      <Brand />
      <button className="icon-button auth-theme" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
      <div className="auth-form-wrap">
        <h2 id="auth-heading">{isSignup ? 'Join BlogDex' : isReset ? 'Reset your password' : 'Login to BlogDex'}</h2>
        {isReset && <p className="auth-reset-note">Enter your email and we’ll send you a reset link.</p>}
        <form onSubmit={submit} className="form-stack">
          {isSignup && <><label><span className="sr-only">Display name</span><div className="auth-input-row"><Icon name="user" /><input name="display_name" placeholder="Display name" autoComplete="name" required maxLength={50} /></div></label><label><span className="sr-only">Username</span><div className="auth-input-row"><span aria-hidden="true">@</span><input name="username" placeholder="Choose a username" autoComplete="username" autoCapitalize="none" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" title="3–24 lowercase letters, numbers, or underscores" /></div></label></>}
          <label><span className="sr-only">Email address</span><div className="auth-input-row"><Icon name="user" /><input ref={emailInput} name="email" type="email" placeholder="Email address" autoComplete="email" autoCapitalize="none" required /></div></label>
          {!isReset && <label><span className="sr-only">Password</span><div className="auth-input-row"><Icon name="lock" /><input name="password" type={showPassword ? 'text' : 'password'} placeholder={isSignup ? 'Password (at least 8 characters)' : 'Enter your password'} minLength={isSignup ? 8 : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'} required /><button type="button" className="icon-button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}><Icon name={showPassword ? 'eyeOff' : 'eye'} size={18} /></button></div></label>}
          <ErrorBox message={error} />
          {message && <p className="success-box" role="status"><Icon name="check" />{message}</p>}
          <button className="button auth-submit" disabled={busy}>{busy ? 'Just a moment…' : isSignup ? 'Sign Up' : isReset ? 'Send reset link' : 'Login'}</button>
        </form>
        {mode === 'login' && <button type="button" className="text-button forgot" disabled={busy} onClick={() => changeMode('reset')}>Forgot Password?</button>}
        {!isReset && <button type="button" className="text-button auth-resend" disabled={busy} onClick={resendConfirmation}>{confirmationEmail ? 'Resend confirmation email' : 'Need a new confirmation link?'}</button>}
        {isReset ? <button className="text-button auth-back" disabled={busy} onClick={() => changeMode('login')}><Icon name="back" size={16} /> Back to Login</button> : <p className="auth-switch">{isSignup ? 'Already have an account?' : 'Don’t have an account?'} <button className="text-button" disabled={busy} onClick={() => changeMode(isSignup ? 'login' : 'signup')}>{isSignup ? 'Login' : 'Sign Up'}</button></p>}
      </div>
      <p className="auth-footer">© {new Date().getFullYear()} BlogDex</p>
    </section>
  </main>;
}

export function ProfileSetup({ user, onComplete, onSignOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      check(await supabase.from('blogdex_profiles').insert({ id: user.id, username: String(form.get('username')).trim().toLowerCase(), display_name: String(form.get('display_name')).trim(), bio: String(form.get('bio') || '').trim() }));
      onComplete();
    } catch (error) { setError(friendlyError(error)); }
    finally { setBusy(false); }
  }
  return <main className="setup-page"><Brand /><div className="setup-card"><span className="auth-mark"><Icon name="user" size={28} /></span><h1>Make yourself at home.</h1><p className="muted">Choose the name your community will see.</p><form className="form-stack" onSubmit={submit}><label>Display name<input name="display_name" required maxLength={50} autoComplete="name" defaultValue={user.user_metadata?.display_name || ''} placeholder="Your name" /></label><label>Username<div className="input-prefix"><span>@</span><input name="username" required minLength={3} maxLength={24} pattern="[a-z0-9_]{3,24}" defaultValue={user.user_metadata?.username || ''} placeholder="your_username" /></div><small>3–24 lowercase letters, numbers, or underscores.</small></label><label>A little about you<textarea name="bio" maxLength={160} rows={3} placeholder="What are you into?" /></label><ErrorBox message={error} /><button className="button primary" disabled={busy}>{busy ? 'Creating profile…' : 'Let’s get started'}<Icon name="arrow" size={18} /></button></form><button className="text-button auth-back" onClick={onSignOut}>Sign out</button></div></main>;
}
