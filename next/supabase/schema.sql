-- French activities · RRU — database (run once in Supabase → SQL Editor → New query → Run).
-- Safe to run again: it only creates what is missing.

create table if not exists activities (
  id        text primary key,
  title     text,
  emoji     text,
  topic     text,
  "for"     text,
  source    text not null check (source in ('github', 'upload')),
  file_path text,                       -- Storage path, for uploaded activities
  hidden    boolean,                    -- null = not changed by the teacher
  removed   boolean not null default false,
  video     text,
  short     text,
  updated   timestamptz not null default now(),
  created   timestamptz not null default now()
);

create table if not exists results (
  id             bigint generated always as identity primary key,
  created        timestamptz not null default now(),
  name           text,
  activity_id    text not null,
  activity_title text,
  level          text,
  score          numeric,
  total          int,
  pct            int,
  first          int,
  second         int,
  review         int,
  errors         text,
  device         text,
  ip_hash        text                   -- for the rate limit only; the address itself is never stored
);

create index if not exists results_ip_created on results (ip_hash, created);
create index if not exists results_activity on results (activity_id);

-- Row-level security ON with no policies: the public (anon / publishable key) can neither read nor write.
-- Only the app's server, using the secret key, can. Students save results through /api/results.
alter table activities enable row level security;
alter table results    enable row level security;

-- Private Storage bucket for activities uploaded from the master page.
insert into storage.buckets (id, name, public)
values ('activities', 'activities', false)
on conflict (id) do nothing;
