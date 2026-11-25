-- Public feed content, but only the server can read or write the cache.
create table if not exists public.feed_cache (
  id text primary key check (id = 'main'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.feed_cache enable row level security;
revoke all on public.feed_cache from anon, authenticated;
grant select, insert, update on public.feed_cache to service_role;

comment on table public.feed_cache is 'Shared 15-minute RSS cache; accessed only by the Next.js server.';
