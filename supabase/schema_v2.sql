-- ============================================================
-- AMORPH BBS — Schema V2 Migration
-- ============================================================

create extension if not exists "pgcrypto";

-- ── UPDATE rooms ──────────────────────────────────────────────
alter table public.rooms
  add column if not exists password_hash   text,
  add column if not exists has_password    boolean default false,
  add column if not exists auto_delete     boolean default false,
  add column if not exists active_members  int     default 0,
  add column if not exists created_by_role text    default 'system';

-- ── ROOM MEMBERS ──────────────────────────────────────────────
create table if not exists public.room_members (
  room_id    uuid references public.rooms(id) on delete cascade,
  user_id    uuid references public.users(id) on delete cascade,
  joined_at  timestamptz default now(),
  primary key (room_id, user_id)
);

create or replace function update_room_member_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update public.rooms set active_members = active_members + 1 where id = NEW.room_id;
  elsif TG_OP = 'DELETE' then
    update public.rooms set active_members = greatest(0, active_members - 1) where id = OLD.room_id;
    delete from public.rooms
    where id = OLD.room_id
      and auto_delete = true
      and is_protected = false
      and active_members <= 0;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists on_room_member_change on public.room_members;
create trigger on_room_member_change
after insert or delete on public.room_members
for each row execute function update_room_member_count();

-- ── UPDATE threads ────────────────────────────────────────────
alter table public.threads
  add column if not exists edited          boolean     default false,
  add column if not exists edited_at       timestamptz,
  add column if not exists deleted_at      timestamptz,
  add column if not exists deleted_by_self boolean     default false,
  add column if not exists original_title  text,
  add column if not exists original_body   text;

create table if not exists public.thread_edits (
  id        uuid primary key default gen_random_uuid(),
  thread_id uuid references public.threads(id) on delete cascade,
  old_title text not null,
  old_body  text not null,
  edited_by uuid references public.users(id) on delete set null,
  edited_at timestamptz default now()
);

-- ── UPDATE replies ────────────────────────────────────────────
alter table public.replies
  add column if not exists edited          boolean     default false,
  add column if not exists edited_at       timestamptz,
  add column if not exists deleted_at      timestamptz,
  add column if not exists deleted_by_self boolean     default false,
  add column if not exists original_body   text;

create table if not exists public.reply_edits (
  id        uuid primary key default gen_random_uuid(),
  reply_id  uuid references public.replies(id) on delete cascade,
  old_body  text not null,
  edited_by uuid references public.users(id) on delete set null,
  edited_at timestamptz default now()
);

-- ── AUDIT LOGS ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  action         text not null,
  actor_id       uuid references public.users(id) on delete set null,
  actor_name     text,
  target_type    text,
  target_id      text,
  target_preview text,
  metadata       jsonb,
  created_at     timestamptz default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_action     on public.audit_logs(action);
create index if not exists idx_audit_logs_actor_id   on public.audit_logs(actor_id);

-- ── UPDATE users ──────────────────────────────────────────────
alter table public.users
  add column if not exists avatar_url text;

-- ── ADMIN LOG ROOM ────────────────────────────────────────────
insert into public.rooms (name, description, is_protected, created_by_role)
values ('ADMIN-LOG', 'System audit log — admin only', true, 'system')
on conflict (name) do nothing;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.room_members enable row level security;
alter table public.thread_edits enable row level security;
alter table public.reply_edits  enable row level security;
alter table public.audit_logs   enable row level security;

create policy if not exists "read_room_members"   on public.room_members for select using (true);
create policy if not exists "write_room_members"  on public.room_members for insert with check (true);
create policy if not exists "delete_room_members" on public.room_members for delete using (true);

create policy if not exists "read_thread_edits"  on public.thread_edits for select using (true);
create policy if not exists "write_thread_edits" on public.thread_edits for insert with check (true);
create policy if not exists "read_reply_edits"   on public.reply_edits  for select using (true);
create policy if not exists "write_reply_edits"  on public.reply_edits  for insert with check (true);

create policy if not exists "read_audit_logs"  on public.audit_logs for select using (true);
create policy if not exists "write_audit_logs" on public.audit_logs for insert with check (true);

-- ── REALTIME ──────────────────────────────────────────────────
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.audit_logs;
