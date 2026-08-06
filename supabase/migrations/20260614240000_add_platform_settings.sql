create table if not exists platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  updated_at timestamptz default now()
);

alter table platform_settings enable row level security;

create policy "Admin full access to platform_settings"
  on platform_settings for all
  using (true)
  with check (true);

insert into platform_settings (key, value)
values ('sender_email', 'donotreply@autopilot.com')
on conflict (key) do nothing;
