# BlogDex

A small social app built with React + Vite, React Router, Node.js, and Supabase. **Vercel hosts the static website. Supabase handles accounts and social records.** The browser talks to Supabase directly; there is no separate backend server, and row-level security policies in the database enforce who can do what. BlogDex is text-only: there are no image, video, or file uploads. Nothing depends on the laptop staying on after deployment.

The Supabase URL and publishable key use your supplied project, `hntpnkuxggdzlyskjjtf`. All new tables use the `blogdex_` prefix. There is no fake content, no sample accounts, and no service-role key.

## 1. Create the Supabase tables

Open https://supabase.com/dashboard/project/hntpnkuxggdzlyskjjtf/sql/new in your browser. Create a new SQL Editor query, paste the entire file, and click **Run**.

Copy the table schema:

```powershell
cd "C:\Users\pokec\Downloads\Scripts\HTML_CSS\BlogDex"
Get-Content -Raw .\supabase\schema.sql | Set-Clipboard
```

Paste and run in Supabase. The script is safe to rerun on a fresh install; existing records are preserved. Existing ticket-booking tables and other storage buckets are not changed.

**Already installed an earlier version that had image/video uploads?** Do not rerun `schema.sql`. Run `supabase/remove-media.sql` once instead:

```powershell
Get-Content -Raw .\supabase\remove-media.sql | Set-Clipboard
```

It drops the media columns, storage policies, and helper functions, and hides (does not delete) any old posts that had no text. It does not delete stored files, so afterwards open **Storage** in the Supabase dashboard, empty the `blogdex-media` bucket, and delete it.

Tables: `blogdex_profiles`, `blogdex_admin`, `blogdex_posts`, `blogdex_likes`, `blogdex_comments`, `blogdex_follows`, `blogdex_bookmarks`, `blogdex_notifications`, `blogdex_reports`, and `blogdex_audit_log`. Profiles reference Supabase Auth accounts; passwords stay in Auth and are never saved in a custom table or shown to the admin.

## 2. Deploy to Vercel

Node.js 24 is configured for this project. Dependencies and your local `.env` are already prepared. You can deploy without a GitHub repository:

```powershell
cd "C:\Users\pokec\Downloads\Scripts\HTML_CSS\BlogDex"
npx vercel login
npx vercel link
```

During `link`, select your Vercel account/team, create a new project named `blogdex`, and use the current directory (`./`). The checked-in `vercel.json` supplies the Vite framework, `npm run build` command, `dist` output folder, and React page rewrites.

**Before deploying**, open the BlogDex project in Vercel and go to **Settings → Environment Variables**. Add these two variables using the values already in `.env.example`:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Apply them to **Production, Preview, and Development**. Use the updated project values in `.env.example`; do not add a service-role key. The publishable key is designed to be used in the browser; database policies enforce permissions.

Now deploy:

```powershell
npx vercel --prod
```

The CLI prints your live URL. Future changes use the same command. Changing a `VITE_` environment value requires redeploying because it is included in the frontend build.

Alternatively, push the folder to your own GitHub repository, import it with **Vercel → Add New → Project**, select **Vite**, add the two environment variables before deployment, and click **Deploy**. `.gitignore` excludes `.env`, dependencies, local diagnostics, and the old local `data` folder.

`.vercelignore` also excludes those files from CLI uploads. Do not upload the old `data` directory or `node_modules` manually.

## 3. Configure signup and email redirects

In your BlogDex Supabase project's **Authentication** settings:

1. Enable Email sign-in and allow new users to sign up.
2. Under **URL Configuration**, set **Site URL** to your live Vercel URL. In **Redirect URLs**, add your exact live Vercel URL and its wildcard form:

```text
https://YOUR-BLOGDEX-URL.vercel.app
https://YOUR-BLOGDEX-URL.vercel.app/**
http://127.0.0.1:5173/**
http://localhost:5173/**
```

Keep any existing redirect URLs you still need. Add your custom domain here too if you use one. If you test email links from a Vercel preview deployment, add that preview URL explicitly.

3. With email confirmation enabled, users must confirm their email before signing in. Password reset also uses email.

4. For public signup and password reset, configure **custom SMTP** in Authentication's email settings. Enter your email provider's SMTP host, port, username, password, and verified sender address/name. Supabase's default mail service only sends to project team members' addresses, so it cannot deliver confirmation/reset emails to arbitrary users. Follow the [official SMTP setup guide](https://supabase.com/docs/guides/auth/auth-smtp).

Supabase Auth supplies the accounts for the configured project. BlogDex profiles, admin roles, posts, and suspensions use separate `blogdex_` tables. A BlogDex suspension blocks BlogDex actions without deleting or banning the Auth account.

## 4. Set your one admin login

Create your real account through the deployed BlogDex signup form, verify the email if required, sign in, and complete your profile. Then copy this admin assignment query, replacing the example email with your signup email:

```powershell
$adminSql = (Get-Content -Raw .\supabase\setup-admin.sql).Replace('YOUR_ADMIN_EMAIL_HERE', 'you@example.com')
$adminSql | Set-Clipboard
```

Paste and run in Supabase SQL Editor. Refresh BlogDex or sign out and back in. **Admin desk** now appears in the sidebar.

The database has one admin slot. Running the assignment for a different account replaces the current admin. Signup metadata cannot grant admin access. The assignment raises an error if the matching BlogDex profile does not exist.

## Updated branding and login screen

The supplied green BlogDex logo now appears throughout the app. The welcome and login cards follow your second reference: a sunset landscape, a starry moonlit landscape, white input fields, and blue buttons. On mobile the cards stack, and the welcome button scrolls to and focuses login. Signup, email login, password visibility, and password reset remain functional. Sign-in uses an email address; usernames identify public profiles.

Artwork, original logo source, and the image generation prompt are documented in `public/ASSETS.md`. To publish this update, deploy again after completing the setup above.

## What is included

- Reference-inspired dark/light layout with BlogDex branding, sidebar, search, notifications, feed, topics, and suggested people.
- Responsive mobile navigation, persistent theme selection, accessible dialogs/controls, and Ctrl+K search.
- Email signup/sign-in, persistent sessions, sign-out, password reset, and profile onboarding.
- Display names (with initial-based avatars), bios, locations, websites, follower/following lists, and post counts.
- Text posts, editing your post text, deleting your posts, sharing links, and hashtag/mention links.
- Latest posts, a Following feed, likes, replies, follows, and private saved Collections.
- Search for posts and people, real weekly trending hashtags, and real suggested accounts.
- Like/reply/follow notifications, unread indicators, mark as read, and Realtime refresh.
- One admin with member emails/last sign-in times, user suspension/restoration, post hiding/restoration, comment removal, report handling, and moderation history.
- Separate BlogDex database policies and ownership checks enforced by Supabase.

Posts are text-only and support **1,000 characters**. There are no direct messages, stories, or reposts in this first version.

## Local development

Run the app locally (it reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`):

```powershell
npm run dev
```

Open http://127.0.0.1:5173/. A local production preview uses:

```powershell
npm run build
npm run preview
```

Open http://127.0.0.1:4173/. To install fresh dependencies on another machine:

```powershell
Copy-Item .env.example .env
npm ci
npm run dev
```

If posting fails, the red message in the Post dialog is the exact error from Supabase. A "permission" or "row-level security" error usually means `supabase/schema.sql` (or `remove-media.sql` for an older install) has not been run, or your profile setup was not finished. A network error means the browser cannot reach your Supabase project; check the two environment variables.

## Validation and deployment status

The production frontend builds, and the post create/edit/delete statements were exercised against the schema's row-level security policies in a local Postgres. No fake accounts or posts were created. A full automated test suite is omitted for your time limit. Live login, row policies, and moderation need the SQL files installed and a real account; outbound Supabase access was unavailable in this environment. This folder is prepared for deployment, but no Vercel account is connected here and no live deployment has been created.

References: [Vite deployment on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel function limits](https://vercel.com/docs/functions/limitations), and [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
