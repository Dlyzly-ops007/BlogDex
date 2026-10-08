// Accept default Supabase redirects and explicit token-hash email templates.
export async function initializeAuth(auth, href) {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const errorCode = url.searchParams.get('error_code') || fragment.get('error_code');
  if (errorCode === 'otp_expired') throw new Error('This email link expired or was already used. Try logging in, or request a new confirmation link.');
  const description = url.searchParams.get('error_description') || fragment.get('error_description');
  if (description) throw new Error(description);
  const type = url.searchParams.get('type') || fragment.get('type');
  const tokenHash = url.searchParams.get('token_hash');
  if (tokenHash && !['email', 'signup', 'recovery', 'invite', 'email_change'].includes(type)) throw new Error('This email link is invalid. Request a new confirmation email.');
  const result = tokenHash ? await auth.verifyOtp({ token_hash: tokenHash, type }) : await auth.getSession();
  if (result.error?.code === 'otp_expired') throw new Error('This email link expired or was already used. Try logging in, or request a new confirmation link.');
  if (result.error) throw result.error;
  if (url.searchParams.has('code') && !result.data.session) throw new Error('This link could not finish sign-in. Request a new confirmation email.');
  for (const name of ['token_hash', 'type', 'code']) url.searchParams.delete(name);
  url.hash = '';
  return { session: result.data.session, recovery: type === 'recovery', cleanUrl: url.pathname + url.search };
}
