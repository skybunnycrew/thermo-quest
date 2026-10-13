# Thermo Quest: class server setup

The game ships as four files that must stay together: `Thermo Quest.dc.html`, `steam.js`, `net.js`, `multiplayer-config.js` (plus `support.js`).

Without a class server the game runs in **demo mode**: two demo classmates wander the map, and only other tabs in the same browser can see or hear you. A class server lets every student who opens the game share one world: they see each other walk, chat, wave, and see who is inside which station. Problems inside the doors stay individual.

## Set up (about five minutes, free)

1. Go to https://supabase.com, click **Start your project**, sign up with GitHub or email. The free plan is plenty.
2. **New project**: name it `thermo-quest`, set any database password (not needed by the game), pick the region nearest your school, **Create**. Wait about a minute.
3. Left sidebar, **Project Settings** (gear icon).
   - **Data API** shows the **Project URL** (looks like `https://abcdefgh.supabase.co`).
   - **API Keys** shows the key. Copy the one labelled **publishable** (or the legacy **anon public** key; either works). Never use the service_role / secret key.
4. Open `multiplayer-config.js` in any text editor and paste both values between the quotes:

   ```js
   SUPABASE_URL: 'https://abcdefgh.supabase.co',
   SUPABASE_ANON_KEY: 'sb_publishable_...',
   TEACHER_PASSWORD: 'pick-something',
   ```

5. Saved chat history (optional): left sidebar **SQL Editor**, **New query**, paste this, **Run**:

   ```sql
   create table if not exists public.messages (
     id bigint generated always as identity primary key,
     created_at timestamptz not null default now(),
     room text not null,
     name text not null default '',
     body text not null default '',
     kind text not null default 'chat'
   );
   alter table public.messages enable row level security;
   create policy "class can read" on public.messages
     for select to anon, authenticated using (true);
   create policy "class can post" on public.messages
     for insert to anon, authenticated with check (char_length(body) <= 200);
   create index if not exists messages_room_time
     on public.messages (room, created_at desc);
   ```

   Skip this and chat still works; it just starts empty on every visit and the chat panel says "history is off".
6. Host the files anywhere students can open them (GitHub Pages, Netlify Drop, your LMS file area, a shared drive). Reload the game: the dot in the chat header turns green and says ONLINE.

## Teacher controls

Click **TEACHER** under the chat (or type `/teacher your-password` in chat). You then get:

- **Announcement**: a yellow banner above everyone's game until you turn it off.
- **Clear chat for everyone**.
- **Mute / unmute** any player from the roster. Muted players can read but not send.

Teacher mode is remembered in that browser; **LOG OUT** ends it.

## Notes

- Several classes on one project: give each its own `ROOM` name in the config file.
- Bad-word filter runs on every message, both when sending and receiving.
- Free-tier limits (200 simultaneous connections) are far above a classroom.
- The password is in a plain text file, so it keeps students honest, not determined.
