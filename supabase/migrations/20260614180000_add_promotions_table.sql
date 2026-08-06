create table if not exists promotions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  title text not null,
  description text,
  discount_type text check (discount_type in ('percentage','fixed','bogo','free_item','other')),
  discount_value text,
  promo_code text,
  start_date date not null,
  end_date date not null,
  platforms text[] default '{}',
  status text default 'scheduled' check (status in ('active','scheduled','expired')),
  created_at timestamptz default now()
);

alter table promotions enable row level security;

create policy "Admin full access to promotions"
  on promotions for all
  using (true)
  with check (true);
