-- ============================================================
-- AMORPH BBS — Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── USERS ────────────────────────────────────────────────────
create table public.users (
  id                uuid primary key default gen_random_uuid(),
  username          text unique not null,
  password_hash     text not null,

  -- Discord linkage (filled when verify code is used)
  discord_user_id   text unique,
  discord_username  text,

  -- Verify code (1 code ↔ 1 account, forever)
  verify_code       text unique,
  is_verified       boolean default false,

  -- Status
  role              text not null default 'user' check (role in ('user','admin')),
  is_banned         boolean default false,
  ban_reason        text,

  created_at        timestamptz default now()
);

-- ── PROFILES (max 5 per user) ─────────────────────────────────
create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users(id) on delete cascade,
  display_name  text not null,
  avatar        text not null default '◈',   -- symbol character
  color         text not null default '#00d4ff',
  is_default    boolean default false,
  created_at    timestamptz default now(),

  constraint max_profiles_per_user unique (user_id, display_name)
);

-- Enforce max 5 profiles per user
create or replace function check_profile_limit()
returns trigger as $$
begin
  if (select count(*) from public.profiles where user_id = NEW.user_id) >= 5 then
    raise exception 'Maximum 5 profiles per account';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger enforce_profile_limit
before insert on public.profiles
for each row execute function check_profile_limit();

-- ── INVITE CODES ──────────────────────────────────────────────
-- Bot writes here when /getcode is called
create table public.invite_codes (
  code                text primary key,
  discord_user_id     text not null,
  discord_username    text not null,
  discord_avatar_url  text,

  -- Lifecycle
  issued_at           timestamptz default now(),
  used                boolean default false,
  used_by_user_id     uuid references public.users(id) on delete set null,
  used_at             timestamptz,

  -- Revoke (admin can revoke)
  revoked             boolean default false,
  revoked_at          timestamptz,
  revoked_by          text,   -- admin username who revoked
  revoke_reason       text
);

-- ── CHAT ROOMS ────────────────────────────────────────────────
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  description text,
  created_by  uuid references public.users(id) on delete set null,
  is_protected boolean default false,  -- protected rooms can't be deleted
  created_at  timestamptz default now()
);

-- ── CHAT MESSAGES (NOT anonymous — shows real username) ───────
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.rooms(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  content     text not null,
  deleted     boolean default false,
  deleted_by  text,
  created_at  timestamptz default now()
);

-- ── FORUM THREADS (anonymous — requires is_verified) ─────────
create table public.threads (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  tag         text default 'new' check (tag in ('hot','new','pinned','discussion')),
  is_pinned   boolean default false,
  reply_count int default 0,

  -- Author tracking (hidden from non-admins)
  author_id      uuid references public.users(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,

  deleted     boolean default false,
  deleted_by  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── FORUM REPLIES (anonymous — requires is_verified) ─────────
create table public.replies (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid references public.threads(id) on delete cascade,
  body        text not null,

  -- Author tracking (hidden from non-admins)
  author_id         uuid references public.users(id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,

  deleted     boolean default false,
  deleted_by  text,
  created_at  timestamptz default now()
);

-- ── DIRECT MESSAGES ───────────────────────────────────────────
create table public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid references public.users(id) on delete set null,
  receiver_id uuid references public.users(id) on delete set null,
  content     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- DM conversations view (unique pairs)
create view public.dm_conversations as
select distinct
  least(sender_id, receiver_id)    as user_a,
  greatest(sender_id, receiver_id) as user_b
from public.direct_messages;

-- ── INDEXES ───────────────────────────────────────────────────
create index on public.messages(room_id, created_at desc);
create index on public.threads(created_at desc) where deleted = false;
create index on public.replies(thread_id, created_at asc) where deleted = false;
create index on public.direct_messages(sender_id, receiver_id, created_at);
create index on public.invite_codes(discord_user_id);
create index on public.profiles(user_id);

-- ── AUTO reply_count ──────────────────────────────────────────
create or replace function update_reply_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.threads
    set reply_count = reply_count + 1, updated_at = now()
    where id = NEW.thread_id;
  elsif TG_OP = 'UPDATE' and NEW.deleted = true and OLD.deleted = false then
    update public.threads
    set reply_count = greatest(0, reply_count - 1)
    where id = NEW.thread_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger on_reply_change
after insert or update on public.replies
for each row execute function update_reply_count();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table public.users          enable row level security;
alter table public.profiles       enable row level security;
alter table public.invite_codes   enable row level security;
alter table public.rooms          enable row level security;
alter table public.messages       enable row level security;
alter table public.threads        enable row level security;
alter table public.replies        enable row level security;
alter table public.direct_messages enable row level security;

-- Public read (threads/replies show as anon — handled in API)
create policy "public_read_threads"  on public.threads  for select using (deleted = false);
create policy "public_read_replies"  on public.replies  for select using (deleted = false);
create policy "public_read_rooms"    on public.rooms    for select using (true);
create policy "public_read_messages" on public.messages for select using (deleted = false);
create policy "public_read_users"    on public.users    for select using (true);
create policy "public_read_profiles" on public.profiles for select using (true);

-- All writes go through service role (API routes handle auth)
create policy "service_insert_threads"   on public.threads   for insert with check (true);
create policy "service_update_threads"   on public.threads   for update using (true);
create policy "service_insert_replies"   on public.replies   for insert with check (true);
create policy "service_update_replies"   on public.replies   for update using (true);
create policy "service_insert_messages"  on public.messages  for insert with check (true);
create policy "service_update_messages"  on public.messages  for update using (true);
create policy "service_insert_rooms"     on public.rooms     for insert with check (true);
create policy "service_delete_rooms"     on public.rooms     for delete using (true);
create policy "service_insert_users"     on public.users     for insert with check (true);
create policy "service_update_users"     on public.users     for update using (true);
create policy "service_insert_profiles"  on public.profiles  for insert with check (true);
create policy "service_update_profiles"  on public.profiles  for update using (true);
create policy "service_delete_profiles"  on public.profiles  for delete using (true);
create policy "service_insert_codes"     on public.invite_codes for insert with check (true);
create policy "service_update_codes"     on public.invite_codes for update using (true);
create policy "service_select_codes"     on public.invite_codes for select using (true);
create policy "service_insert_dms"       on public.direct_messages for insert with check (true);
create policy "service_select_dms"       on public.direct_messages for select using (true);
create policy "service_update_dms"       on public.direct_messages for update using (true);

-- ── SEED DEFAULT ROOMS ────────────────────────────────────────
insert into public.rooms (name, description, is_protected) values
  ('AMORPH',        'The formless collective. Anyone can join.', true),
  ('IKEBUKURO',     'General Ikebukuro talk.',                   true),
  ('YELLOW-SCARVES','Masaomi''s territory.',                     false),
  ('BLUE-SQUARES',  'The splinter group.',                       false);

-- ── REALTIME ──────────────────────────────────────────────────
-- Enable in Supabase Dashboard → Database → Replication:
-- Tables: messages, direct_messages, threads, replies
