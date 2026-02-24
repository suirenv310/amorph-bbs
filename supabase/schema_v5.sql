-- ============================================================
-- AMORPH BBS — Schema V5
-- Vote system (up/down) for threads and replies
-- ============================================================

-- ── VOTES ─────────────────────────────────────────────────────
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete cascade not null,
  target_type text not null check (target_type in ('thread', 'reply')),
  target_id   uuid not null,
  value       smallint not null check (value in (1, -1)),  -- 1 = upvote, -1 = downvote
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  unique (user_id, target_type, target_id)  -- 1 vote per user per target
);

create index if not exists idx_votes_target on public.votes(target_type, target_id);
create index if not exists idx_votes_user   on public.votes(user_id);

-- ── ADD vote counts to threads ────────────────────────────────
alter table public.threads
  add column if not exists upvotes   int default 0,
  add column if not exists downvotes int default 0,
  add column if not exists score     int generated always as (upvotes - downvotes) stored;

-- ── ADD vote counts to replies ────────────────────────────────
alter table public.replies
  add column if not exists upvotes   int default 0,
  add column if not exists downvotes int default 0,
  add column if not exists score     int generated always as (upvotes - downvotes) stored;

-- ── TRIGGER: keep counts in sync ─────────────────────────────
create or replace function sync_vote_counts()
returns trigger as $$
declare
  tbl text;
begin
  -- Determine table name
  if TG_OP = 'DELETE' then
    tbl := OLD.target_type || 's';  -- 'threads' or 'replies'
  else
    tbl := NEW.target_type || 's';
  end if;

  if TG_OP = 'INSERT' then
    if NEW.value = 1 then
      execute format('update public.%I set upvotes = upvotes + 1 where id = $1', tbl) using NEW.target_id;
    else
      execute format('update public.%I set downvotes = downvotes + 1 where id = $1', tbl) using NEW.target_id;
    end if;

  elsif TG_OP = 'UPDATE' then
    -- Switched vote direction
    if OLD.value = 1 and NEW.value = -1 then
      execute format('update public.%I set upvotes = upvotes - 1, downvotes = downvotes + 1 where id = $1', tbl) using NEW.target_id;
    elsif OLD.value = -1 and NEW.value = 1 then
      execute format('update public.%I set upvotes = upvotes + 1, downvotes = downvotes - 1 where id = $1', tbl) using NEW.target_id;
    end if;

  elsif TG_OP = 'DELETE' then
    if OLD.value = 1 then
      execute format('update public.%I set upvotes = greatest(0, upvotes - 1) where id = $1', tbl) using OLD.target_id;
    else
      execute format('update public.%I set downvotes = greatest(0, downvotes - 1) where id = $1', tbl) using OLD.target_id;
    end if;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists on_vote_change on public.votes;
create trigger on_vote_change
after insert or update or delete on public.votes
for each row execute function sync_vote_counts();

-- ── RLS ───────────────────────────────────────────────────────
alter table public.votes enable row level security;

do $$ begin
  create policy "read_votes"   on public.votes for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "insert_votes" on public.votes for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "update_votes" on public.votes for update using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "delete_votes" on public.votes for delete using (true);
exception when duplicate_object then null; end $$;
