create table if not exists holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  month integer not null check (month between 1 and 12),
  day integer,
  week_of_month integer,
  day_of_week integer,
  country_codes text[] default '{}',
  category text check (category in ('national','religious','cultural','commercial','universal')),
  active boolean default true,
  created_at timestamptz default now()
);

create unique index if not exists holidays_name_unique on holidays (name);

create table if not exists company_holidays (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  holiday_id uuid references holidays(id) on delete cascade not null,
  enabled boolean default true,
  custom_name text,
  created_at timestamptz default now(),
  unique(company_id, holiday_id)
);

alter table company_holidays enable row level security;
alter table holidays enable row level security;

create policy "Admin full access to holidays"
  on holidays for all using (true) with check (true);

create policy "Admin full access to company_holidays"
  on company_holidays for all using (true) with check (true);
