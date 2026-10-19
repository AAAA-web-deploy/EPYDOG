-- Sleepy Dogs Club: private, moderated photo uploads for a static Next.js site.
-- Run ONCE in Supabase Dashboard > SQL Editor with the project owner's credentials.
-- NEVER run an unrestricted "public upload" policy. NEVER embed service_role keys in the website.
-- Enable Authentication > Providers > Anonymous Sign-Ins before testing uploads.
-- Configure Supabase Auth CAPTCHA / bot protection before announcing publicly.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sleepy-dogs-private','sleepy-dogs-private',false,5242880,array['image/jpeg'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg'];

create table if not exists public.sdc_photos (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete cascade,
  storage_path text unique not null,
  dog_name text not null check (char_length(dog_name) between 1 and 48),
  display_name text not null default 'a sleepy dog parent' check (char_length(display_name) between 1 and 40),
  caption text not null default '' check (char_length(caption) <= 220),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);
create index if not exists sdc_photos_feed on public.sdc_photos (created_at desc) where status='approved';
create index if not exists sdc_photos_owner on public.sdc_photos (uploader_id,created_at desc);
alter table public.sdc_photos enable row level security;

revoke all on public.sdc_photos from public, anon, authenticated;
grant select on public.sdc_photos to anon, authenticated;
grant insert on public.sdc_photos to authenticated;

drop policy if exists sdc_photos_view_approved_or_own on public.sdc_photos;
create policy sdc_photos_view_approved_or_own on public.sdc_photos
for select to anon, authenticated using (status = 'approved' or uploader_id = (select auth.uid()));

drop policy if exists sdc_photos_insert_pending_only on public.sdc_photos;
create policy sdc_photos_insert_pending_only on public.sdc_photos
for insert to authenticated with check (
  uploader_id = (select auth.uid()) and status = 'pending'
  and storage_path ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
);

-- Enforce daily metadata quota and make sure the caller actually uploaded the referenced file.
-- This is deliberately an additional limit, not a substitute for Auth CAPTCHA or edge rate limiting.
create or replace function public.sdc_check_submission()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  last_day integer;
begin
  if new.uploader_id is distinct from auth.uid() or new.status <> 'pending' then
    raise exception 'Invalid photo submission';
  end if;
  if new.storage_path !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.jpg$') then
    raise exception 'Photo storage path must belong to the uploading account';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'sleepy-dogs-private'
      and name = new.storage_path
      and owner_id = auth.uid()::text
  ) then
    raise exception 'Photo upload must exist in private storage before submission';
  end if;
  select count(*) into last_day from public.sdc_photos
    where uploader_id = auth.uid() and created_at > now() - interval '24 hours';
  if last_day >= 3 then
    raise exception 'Three submissions per visitor are permitted every 24 hours';
  end if;
  return new;
end;
$$;
revoke all on function public.sdc_check_submission() from public, anon, authenticated;
drop trigger if exists sdc_check_submission_insert on public.sdc_photos;
create trigger sdc_check_submission_insert before insert on public.sdc_photos
for each row execute function public.sdc_check_submission();

-- Small per-identity storage quota to reduce orphaned blobs in addition to metadata quota.
-- CAPTCHA / server-side abuse monitoring are still required because guests may recreate identities.
create or replace function public.sdc_can_upload_storage()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and (select count(*) from storage.objects
         where bucket_id='sleepy-dogs-private'
         and owner_id=auth.uid()::text
         and created_at > now() - interval '24 hours') < 5;
$$;
revoke all on function public.sdc_can_upload_storage() from public, anon, authenticated;
grant execute on function public.sdc_can_upload_storage() to authenticated;

-- Storage RLS: only signed-in visitors (including Supabase anonymous auth sessions)
-- can upload under their own UID folder. The private bucket does not leak pending photos.
drop policy if exists sdc_storage_insert_own on storage.objects;
create policy sdc_storage_insert_own on storage.objects
for insert to authenticated with check (
  bucket_id = 'sleepy-dogs-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.sdc_can_upload_storage())
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}\.jpg$')
);

drop policy if exists sdc_storage_select_approved_or_own on storage.objects;
create policy sdc_storage_select_approved_or_own on storage.objects
for select to anon, authenticated using (
  bucket_id = 'sleepy-dogs-private'
  and (
    owner_id = (select auth.uid())::text
    or exists (select 1 from public.sdc_photos p where p.storage_path = name and p.status = 'approved')
  )
);

-- This allows the browser to clean up a failed submission but never delete an approved post.
drop policy if exists sdc_storage_delete_unpublished_own on storage.objects;
create policy sdc_storage_delete_unpublished_own on storage.objects
for delete to authenticated using (
  bucket_id = 'sleepy-dogs-private'
  and owner_id = (select auth.uid())::text
  and not exists (select 1 from public.sdc_photos p where p.storage_path = name and p.status = 'approved')
);

-- Reports for moderators; reporters cannot browse or change other people's reports.
create table if not exists public.sdc_reports (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.sdc_photos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'community report' check (char_length(reason) between 1 and 140),
  created_at timestamptz not null default now(),
  unique (photo_id, reporter_id)
);
alter table public.sdc_reports enable row level security;
revoke all on public.sdc_reports from public, anon, authenticated;
grant insert on public.sdc_reports to authenticated;
drop policy if exists sdc_reports_authenticated_insert on public.sdc_reports;
create policy sdc_reports_authenticated_insert on public.sdc_reports
for insert to authenticated with check (
  reporter_id = (select auth.uid())
  and exists (select 1 from public.sdc_photos p where p.id = photo_id and p.status='approved')
);

-- Publication workflow: in the Supabase Dashboard SQL Editor, for each reviewed ID:
-- update public.sdc_photos set status='approved', moderated_at=now() where id='REVIEWED_UUID' and status='pending';
-- Rejection:
-- update public.sdc_photos set status='rejected', moderated_at=now() where id='REVIEWED_UUID' and status='pending';
