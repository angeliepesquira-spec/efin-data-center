-- Run once in the Supabase SQL editor (Project -> SQL Editor).
-- The backend uses the SERVICE ROLE key, so keep RLS enabled and add no public policies.

create table if not exists uploads (
  id           uuid primary key default gen_random_uuid(),
  report_type  text        not null,
  filename     text        not null,
  uploaded_at  timestamptz not null default now(),
  row_count    integer     not null default 0,
  columns      jsonb       not null default '[]',
  preview      jsonb       not null default '[]',
  sheets       jsonb       not null default '[]',   -- parsed rows, one entry per sheet
  active       boolean     not null default true     -- latest upload per report type
);
create index if not exists uploads_type_idx on uploads (report_type, uploaded_at desc);

create table if not exists snapshots (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  source      text        not null,                  -- 'upload' or 'analysis'
  data        jsonb       not null                   -- the dashboard DATA object
);

alter table uploads   enable row level security;
alter table snapshots enable row level security;
