-- PNA Website — run this once in the Supabase SQL editor.
-- Project → SQL Editor → New query → paste → Run.

create table if not exists public.app_documents (
  name text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_documents enable row level security;

-- Browser/anon clients cannot read or write documents.
-- The Next.js server uses the service role key (bypasses RLS).

insert into storage.buckets (id, name, public)
values
  ('public-uploads', 'public-uploads', true),
  ('private-uploads', 'private-uploads', false)
on conflict (id) do update
set public = excluded.public;

-- Public QR / speaker / certificate images are readable by anyone with the URL.
drop policy if exists "Public uploads are readable" on storage.objects;
create policy "Public uploads are readable"
on storage.objects
for select
to public
using (bucket_id = 'public-uploads');

-- Private receipts/IDs are only reachable through the admin API (service role).
drop policy if exists "Private uploads not public" on storage.objects;
create policy "Private uploads not public"
on storage.objects
for select
to public
using (false);
