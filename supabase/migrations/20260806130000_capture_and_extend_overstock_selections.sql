-- Capture-then-extend ads.overstock_selections (Phase 1 scoring columns).
--
-- Intent:
--   1) Capture the live-only table into migrations so fresh envs get the Part A/B
--      queue shape (skus, post_count, status queued/consumed/cancelled, consume FKs).
--   2) Additively extend with nullable/defaulted scoring columns so existing
--      queueOverstockSelection INSERTs (which omit these columns) keep working.
--
-- Boundary: ads schema ONLY. No public tables/views.
--
-- Live status CHECK name (confirmed via pg_constraint on project qunnxsxeevoeflqfrzwz):
--   overstock_selections_status_check
--   CHECK (status = ANY (ARRAY['queued','consumed','cancelled']))
-- The DO-block below discovers the status CHECK by definition (not hard-coded name)
-- so rename drift cannot break the expansion.

-- ---------------------------------------------------------------------------
-- 1) Capture current live shape (idempotent)
-- ---------------------------------------------------------------------------
create table if not exists ads.overstock_selections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references ads.companies(id),
  skus text[] not null,
  post_count integer not null,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  created_by_email text,
  consumed_at timestamptz,
  consumed_by_run_id uuid references ads.content_runs(id),
  constraint overstock_selections_post_count_check check (post_count > 0),
  -- Initial queue-only statuses; expanded to recommendation lifecycle below.
  constraint overstock_selections_status_check
    check (status = any (array['queued'::text, 'consumed'::text, 'cancelled'::text]))
);

create index if not exists idx_overstock_selections_company_status
  on ads.overstock_selections (company_id, status, created_at desc);

-- Ensure CHECKs exist on already-created tables (CREATE TABLE IF NOT EXISTS
-- does not add missing constraints to an existing relation).
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'ads'
      and t.relname = 'overstock_selections'
      and c.conname = 'overstock_selections_post_count_check'
  ) then
    alter table ads.overstock_selections
      add constraint overstock_selections_post_count_check
      check (post_count > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Expand status CHECK for scored-recommendation lifecycle (option a)
--
-- Allowed after this migration:
--   queued | consumed | cancelled  -- Part A/B manual queue flow
--   recommended | dismissed | approved  -- Phase 1c scored recommendations
--
-- Scored rows MUST use status='recommended' (not 'queued') so
-- getLatestQueuedSelection (status='queued') never picks them up.
-- ---------------------------------------------------------------------------
do $$
declare
  status_check_name text;
begin
  -- Prefer the known live name; fall back to any CHECK whose definition
  -- mentions status (guards rename / alternate capture paths).
  select c.conname
  into status_check_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'ads'
    and t.relname = 'overstock_selections'
    and c.contype = 'c'
    and c.conname = 'overstock_selections_status_check'
  limit 1;

  if status_check_name is null then
    select c.conname
    into status_check_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'ads'
      and t.relname = 'overstock_selections'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
      and pg_get_constraintdef(c.oid) not ilike '%post_count%'
    limit 1;
  end if;

  if status_check_name is not null then
    execute format(
      'alter table ads.overstock_selections drop constraint %I',
      status_check_name
    );
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'ads'
      and t.relname = 'overstock_selections'
      and c.conname = 'overstock_selections_status_check'
  ) then
    alter table ads.overstock_selections
      add constraint overstock_selections_status_check
      check (
        status = any (
          array[
            'queued'::text,
            'consumed'::text,
            'cancelled'::text,
            'recommended'::text,
            'dismissed'::text,
            'approved'::text
          ]
        )
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Phase 1 scoring columns (additive; nullable or defaulted)
-- ---------------------------------------------------------------------------
alter table ads.overstock_selections
  add column if not exists opportunity_score numeric;

alter table ads.overstock_selections
  add column if not exists score_breakdown jsonb;

alter table ads.overstock_selections
  add column if not exists rank integer;

alter table ads.overstock_selections
  add column if not exists product_group text;

alter table ads.overstock_selections
  add column if not exists selection_reason text;

-- Eligibility for scoring pipeline; distinct from queue status column.
alter table ads.overstock_selections
  add column if not exists eligibility_status text;

alter table ads.overstock_selections
  add column if not exists inventory_snapshot jsonb;

-- Isolates Part A/B queue rows from scored recommendations.
-- Existing rows and queue INSERTs that omit this column get 'manual_queue'.
alter table ads.overstock_selections
  add column if not exists source_type text not null default 'manual_queue';

alter table ads.overstock_selections
  add column if not exists analysis_generated_at timestamptz;

comment on column ads.overstock_selections.opportunity_score is
  'Deterministic Overstock Advertising Opportunity Score (Phase 1).';
comment on column ads.overstock_selections.score_breakdown is
  'JSON breakdown of opportunity_score factors for auditability.';
comment on column ads.overstock_selections.rank is
  '1-based rank within a scored recommendation batch.';
comment on column ads.overstock_selections.product_group is
  'Grouping key (typically products.category) for diversifying recommendations.';
comment on column ads.overstock_selections.selection_reason is
  'Human-readable reason this SKU/batch was recommended.';
comment on column ads.overstock_selections.eligibility_status is
  'Scoring eligibility label; not the queue status column.';
comment on column ads.overstock_selections.inventory_snapshot is
  'Point-in-time inventory/scoring inputs at analysis time.';
comment on column ads.overstock_selections.source_type is
  'manual_queue = Part A/B user queue; overstock_score = Phase 1 scored recommendation.';
comment on column ads.overstock_selections.analysis_generated_at is
  'When the scored recommendation analysis was generated.';

-- ---------------------------------------------------------------------------
-- 4) Partial index for recommendation lookups
-- ---------------------------------------------------------------------------
create index if not exists idx_overstock_selections_recommendations
  on ads.overstock_selections (company_id, source_type, rank)
  where source_type = 'overstock_score';

-- ---------------------------------------------------------------------------
-- 5) RLS: enable on fresh create; do not drop or weaken existing policies
-- ---------------------------------------------------------------------------
alter table ads.overstock_selections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'ads'
      and tablename = 'overstock_selections'
      and policyname = 'overstock_selections_service_role_all'
  ) then
    create policy overstock_selections_service_role_all
      on ads.overstock_selections
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
