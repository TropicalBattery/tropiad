create table if not exists content_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  week_start date not null,
  status text not null default 'pending',
  trend_brief jsonb,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists uniq_content_runs_company_week
  on content_runs(company_id, week_start);

create index if not exists idx_content_runs_status
  on content_runs(status);

create table if not exists run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references content_runs(id) on delete cascade,
  step_name text not null,
  status text not null default 'pending',
  attempt_count integer default 0,
  input_json jsonb,
  output_json jsonb,
  error_message text,
  cost_usd numeric(10,4) default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_run_steps_run_id on run_steps(run_id);
create index if not exists idx_run_steps_status on run_steps(status);

create table if not exists cost_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  run_id uuid references content_runs(id),
  post_id uuid references posts(id),
  provider text not null,
  model text,
  step_name text,
  estimated_cost_usd numeric(10,4) not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_cost_events_company
  on cost_events(company_id);
create index if not exists idx_cost_events_run
  on cost_events(run_id);

alter table posts add column if not exists run_id uuid
  references content_runs(id);
