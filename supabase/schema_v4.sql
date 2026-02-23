-- ============================================================
-- AMORPH BBS — Schema V4
-- Media attachments, spoiler, public/anon visibility
-- ============================================================

-- ── THREADS: thêm media, spoiler, visibility ─────────────────
alter table public.threads
  add column if not exists media_urls    text[]  default '{}',   -- array of storage URLs
  add column if not exists media_types   text[]  default '{}',   -- 'image' | 'video' per slot
  add column if not exists is_spoiler    boolean default false,
  add column if not exists visibility    text    default 'anon'  -- 'anon' | 'public'
    check (visibility in ('anon', 'public'));

-- ── REPLIES: thêm media, spoiler, visibility ──────────────────
alter table public.replies
  add column if not exists media_urls    text[]  default '{}',
  add column if not exists media_types   text[]  default '{}',
  add column if not exists is_spoiler    boolean default false,
  add column if not exists visibility    text    default 'anon'
    check (visibility in ('anon', 'public'));

-- ── STORAGE BUCKET: forum-media ───────────────────────────────
-- Chạy trong Supabase Dashboard > Storage > New Bucket:
--   name: forum-media
--   public: true
--   allowed mime types: image/jpeg, image/png, image/webp, image/gif, video/mp4
--   max file size: 20MB
--
-- Hoặc dùng SQL (nếu dùng self-hosted):
-- insert into storage.buckets (id, name, public) values ('forum-media', 'forum-media', true)
-- on conflict do nothing;

-- RLS cho forum-media bucket
do $$ begin
  create policy "forum_media_read"
    on storage.objects for select
    using (bucket_id = 'forum-media');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "forum_media_insert"
    on storage.objects for insert
    with check (bucket_id = 'forum-media');
exception when duplicate_object then null; end $$;
