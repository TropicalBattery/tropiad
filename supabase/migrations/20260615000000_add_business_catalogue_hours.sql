create table if not exists business_catalogue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  item_name text not null,
  category text,
  price_jmd numeric,
  description text,
  available boolean not null default true,
  seasonal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_business_catalogue_company_id
  on business_catalogue(company_id);

create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  open_time time,
  close_time time,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, day_of_week)
);

create index if not exists idx_business_hours_company_id
  on business_hours(company_id);
