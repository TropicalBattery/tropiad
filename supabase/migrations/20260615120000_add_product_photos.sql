create table if not exists product_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  description text,
  photo_url text not null,
  active boolean default true,
  created_at timestamptz default now()
);

alter table product_photos enable row level security;

create policy "Admin full access to product_photos"
  on product_photos for all
  using (true) with check (true);

alter table posts
  add column if not exists featured_product_id uuid
    references product_photos(id) on delete set null;
