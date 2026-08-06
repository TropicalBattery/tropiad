alter table brand_configs
  add column if not exists sections_confirmed jsonb default '{}';
