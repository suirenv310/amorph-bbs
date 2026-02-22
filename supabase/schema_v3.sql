-- ============================================================
-- AMORPH BBS — Schema V3
-- ============================================================

-- ── ROOM BANS ─────────────────────────────────────────────────
create table if not exists public.room_bans (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  banned_by  uuid references public.users(id) on delete set null,
  reason     text,
  created_at timestamptz default now(),
  unique (room_id, user_id)
);

-- ── TRANSFER ROOM OWNERSHIP ───────────────────────────────────
-- rooms.created_by đã có rồi, dùng luôn — chỉ cần API logic

-- ── MESSAGE REPLY/QUOTE ───────────────────────────────────────
alter table public.messages
  add column if not exists reply_to_id      uuid references public.messages(id) on delete set null,
  add column if not exists reply_to_content text,   -- snapshot 1 dòng
  add column if not exists reply_to_author  text;   -- snapshot tên người gửi gốc

-- ── RLS ───────────────────────────────────────────────────────
alter table public.room_bans enable row level security;

do $$ begin
  create policy "read_room_bans"   on public.room_bans for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "write_room_bans"  on public.room_bans for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "delete_room_bans" on public.room_bans for delete using (true);
exception when duplicate_object then null; end $$;
